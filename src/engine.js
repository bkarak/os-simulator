/*
 * OSS, the Operating System Simulator (University of Piraeus, January 1998), re-implemented.
 *
 * engine.js is the simulator with no screen: the command parser, the task table, the three
 * schedulers, memory, the hard disk, the printer and the batch runner. Everything it shows goes
 * through a `view` object and everything it reads from "the real hard drive" (the directory the
 * 1998 program ran in, where its .bch files lived) goes through a `disk` object, so the same code
 * runs in the page and under `node --test`.
 *
 * The behaviour is the one recovered from Os_simulator.exe (see REVERSE-ENGINEERING.md). Where
 * the comments name a routine, it is the original's: the parser was one procedure with a nested
 * procedure per command, the scheduler was the main form's Timer1Timer, and every task ran
 * through execute_task. Where this file deliberately departs from the binary, the comment says
 * "1998:" and what the original did; README.md lists the same departures for a reader.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OSSEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NONE = 'none';            // the original's "no parameter" sentinel, shown by dirtasks
  const SLOTS = 100;              // task table entries
  const CELLS = 100;              // memory and hard-disk positions
  const MEMORY_EMPTY = 'NULL';
  const DISK_EMPTY = 'Empty';

  // Time quanta per command, from the task-creation routine and the help file's command list.
  // The command names keep the trailing space the original stored them with: it shows in the
  // echo, in the Current Task field and in dirtasks' %6s column.
  const QUANTA = {
    'cmp ': 1, 'end': 1, 'ldm ': 1, 'stm ': 1, 'dlm ': 1,
    'scr ': 5, 'dir': 5, 'Run Batch': 5, 'Run Batch Separately': 5,
    'ldd ': 100, 'std ': 100, 'dld ': 100,
    'prn ': 500
  };

  // Parser result codes. 1 queues a task, 5 is done on the spot, the rest are these messages.
  const ERRORS = {
    0: 'Invalid or Misspelled Command!',
    2: 'Incorrect Memory Position Selected!',
    3: 'Misspelled or Missing Parameters!',
    4: 'Invalid Filename!',
    6: 'Command aborted due to occupied address!',
    7: 'Specified Batch File Missing from Virtual Hard Drive'
  };

  const FIFO = 0, ROUND_ROBIN = 1, SJF = 2;
  const ALGORITHMS = ['Fifo Selected...', 'Round Robin Selected...', 'Shortest Job First Selected...'];

  const OVERWRITE = 'The specified address is ocupied.Would you like to overwrite?';

  // ---------------------------------------------------------------------------- string helpers

  // SysUtils.LowerCase: ASCII only. Every command line went through it before parsing, so
  // `scr Hello` printed " hello". Greek letters came through untouched, and still do.
  function lower(s) {
    return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  }

  // The original's space squeezer: drop leading spaces, then collapse the first `runs` runs of
  // spaces to one each and leave the rest of the line alone (stm keeps the spacing of its text).
  function squeeze(runs, s) {
    s = s.replace(/^ +/, '');
    let out = '';
    let i = 0;
    while (i < s.length) {
      const c = s[i++];
      out += c;
      if (c === ' ' && runs > 0) {
        while (s[i] === ' ') i++;
        if (--runs === 0) return out + s.slice(i);
      }
    }
    return out;
  }

  // System.Val for an integer: leading spaces, a sign, decimal digits or $/x hex, nothing after.
  function val(s) {
    const m = /^ *([+-]?)(?:[$xX]([0-9a-fA-F]+)|([0-9]+))$/.exec(s);
    if (!m) return NaN;
    const n = m[2] !== undefined ? parseInt(m[2], 16) : parseInt(m[3], 10);
    return m[1] === '-' ? -n : n;
  }

  // Delphi's Format('%6s') and '%3d': right-justified to a minimum width, never truncated.
  function pad(v, width) {
    return String(v).padStart(width, ' ');
  }

  // Delphi compared strings byte by byte; JavaScript's < does the same on these code units.
  function compare(x, y) {
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function address(n) {
    return '[ ' + n + ']';
  }

  // ------------------------------------------------------------------------------- the parser

  /*
   * One command line in, one record out: { code, cmd, a, b } plus, for the commands done on the
   * spot, `kind` and whatever they need. The original wrote a and b into two globals (a was the
   * text or the address for one-parameter commands, b the address for stm/std and the first
   * string of cmp) and performed the immediate commands' side effects while parsing; here
   * parsing is pure and Simulator.accept/immediate do the rest, so a batch can be checked
   * without running it.
   */
  function parse(input, disk) {
    const s = lower(input);
    const r = { code: 0, cmd: NONE, a: NONE, b: NONE };
    const starts = (p) => s.indexOf(p) === 0;

    if (starts('cmp ')) {
      // cmp /<string1> /<string2>: the two strings are found from the right, at the last " /".
      const t = squeeze(2, s);
      r.code = 1;
      r.cmd = 'cmp ';
      let found = false;
      if (t[3] === ' ' && t[4] === '/' && t.length >= 6) {
        for (let j = t.length; j >= 6; j--) {
          if (t[j - 1] === '/' && t[j - 2] === ' ') {
            r.a = t.slice(j);
            r.b = t.slice(5, j - 2);
            found = true;
            break;
          }
        }
      }
      // 1998: a malformed cmp was queued with both strings 'none' and answered "Equal operands!".
      if (!found) r.code = 3;
    } else if (starts('scr ') || starts('prn ')) {
      // The text is everything after the command word, leading space included, case lowered.
      r.code = 1;
      r.cmd = s.slice(0, 4);
      r.a = s.slice(3);
    } else if (starts('ldm ') || starts('ldd ') || starts('dlm ') || starts('dld ')) {
      const t = squeeze(1, s);
      r.code = 1;
      r.cmd = t.slice(0, 4);
      r.a = t.slice(3);
      const n = val(r.a);
      // 1998: no range check at all, so `ldm 0` printed the logged-in user's name (the global
      // just below the memory array) and `ldm 101` the first disk position; larger numbers read
      // whatever followed. A non-number gave 'Invalid Filename!' for ldm and 'Invalid or
      // Misspelled Command!' for the other three.
      if (Number.isNaN(n)) r.code = 3;
      else if (n < 1 || n > CELLS) r.code = 2;
    } else if (starts('stm ') || starts('std ')) {
      // stm <N> <string>: split at the second space after squeezing the first two runs.
      const t = squeeze(2, s);
      r.code = 1;
      r.cmd = t.slice(0, 4);
      let spaces = 0;
      for (let i = 3; i < t.length; i++) {
        if (t[i] === ' ' && ++spaces === 2) {
          r.b = t.slice(3, i);
          r.a = t.slice(i + 1);
          break;
        }
      }
      const n = val(r.b);
      if (Number.isNaN(n) || r.a === NONE) r.code = 3;
      else if (n < 1 || n > CELLS) r.code = 2;
    } else if (starts('end')) {
      r.code = 1;
      r.cmd = 'end';
    } else if (s === 'dirreal') {
      r.code = 5;
      r.kind = 'dirreal';
    } else if (s === 'dir') {
      r.code = 1;
      r.cmd = 'dir';
    } else if (s === 'dirtasks') {
      r.code = 5;
      r.kind = 'dirtasks';
    } else if (starts('edit')) {
      const name = squeeze(1, s).slice(5);
      r.code = name.length > 4 && name.slice(-4) === '.bch' ? 5 : 4;
      r.kind = 'edit';
      r.file = name;
    } else if (endsWith(s, '.bch /s')) {
      r.cmd = 'Run Batch Separately';
      r.a = s.slice(0, -3);
      r.code = onDisk(disk, r.a) ? 1 : 7;
    } else if (endsWith(s, '.bch')) {
      r.cmd = 'Run Batch';
      r.a = s;
      r.code = onDisk(disk, r.a) ? 1 : 7;
    } else if (starts('terminate')) {
      const n = val(squeeze(1, s).slice(9));
      r.kind = 'terminate';
      r.code = Number.isNaN(n) ? 3 : 5;
      r.number = n;
    }
    return r;
  }

  // 1998: the test was Pos(suffix, s) = Length(s) - Length(suffix) + 1, and Pos returns 0 when
  // the suffix is absent, so every unknown three-letter command was taken for a batch file
  // ("Specified Batch File Missing...") and every unknown six-letter one for a batch run with /s.
  function endsWith(s, suffix) {
    const i = s.indexOf(suffix);
    return i > 0 && i === s.length - suffix.length;
  }

  // A batch file runs only if its name is stored somewhere on the simulated hard disk.
  function onDisk(disk, name) {
    return !!disk && disk.indexOf(name) >= 0;
  }

  // What Execute echoed under the command word: the second parameter, a space, the first.
  function echo(p) {
    if (p.b === NONE && p.a === NONE) return null;      // 1998: printed the word "none"
    if (p.b === NONE) return p.a;
    if (p.a === NONE) return p.b;
    return p.b + ' ' + p.a;
  }

  function quanta(p) {
    // 1998: a batch line that is done on the spot (edit, dirreal, dirtasks, terminate) got no
    // time at all, its countdown went below zero and the batch never finished. One quantum.
    return p.code === 5 ? 1 : QUANTA[p.cmd];
  }

  function lines(text) {
    const ls = text.split(/\r?\n/);
    if (ls.length > 1 && ls[ls.length - 1] === '') ls.pop();
    return ls;
  }

  // -------------------------------------------------------------------------------- simulator

  class Simulator {
    /**
     * @param view  receives everything the program shows (see NullView for the full list)
     * @param files the "real" directory: { read(name) -> string|null, write(name, text), list() }
     */
    constructor(view, files) {
      this.view = Object.assign(Object.create(NullView), view || {});
      this.files = files || memoryFiles();
      this.algorithm = FIFO;
      this.user = '';
      this.interval = 100;        // Timer1.Interval, the time quantum in milliseconds
      this.number = 1;            // next task number; Execute's Tag, never reset, not even by Reset
      this.lastRoundRobin = 0;    // the round-robin cursor, a global the original never reset
      this.timer = false;
      this.frozen = false;
      this.resumeOnContinue = false;
      this.reset();
    }

    // ------------------------------------------------------------------- login and Reset

    login(name, algorithm) {
      this.user = name;
      this.algorithm = algorithm;
      this.reset();
    }

    /** The detection screen, the lines Login printed under its progress bar. */
    detection(algorithm, machine) {
      const m = Object.assign({ processors: 1, physical: [0, 0], swap: [0, 0], granularity: 65536 }, machine);
      const ln = [];
      if (algorithm >= 0) ln.push(ALGORITHMS[algorithm]);
      ln.push('');
      ln.push('Pentium Processor Found');
      ln.push('Number of Processors : ' + m.processors);
      ln.push('');
      ln.push('Memory         Free:             Total:  ');
      ln.push('');
      ln.push('Physical :    ' + pad(m.physical[0], 9) + ' bytes   ' + pad(m.physical[1], 9) + ' bytes');
      ln.push('Swap File:    ' + pad(m.swap[0], 9) + ' bytes   ' + pad(m.swap[1], 9) + ' bytes');
      ln.push('');
      ln.push('Allocation Granularity:' + m.granularity);
      ln.push('');
      ln.push('Simulation initiating....');
      return ln;
    }

    /** The main form's OnShow, also the Reset button: memory, disk, tasks and screen cleared. */
    reset() {
      this.memory = new Array(CELLS + 1).fill(MEMORY_EMPTY);
      this.disk = new Array(CELLS + 1).fill(DISK_EMPTY);
      this.memory[0] = this.disk[0] = undefined;
      this.clearTasks();
      this.setTimer(false);
      const v = this.view;
      v.clear();
      v.active(0);
      v.current('');
      v.remaining(0);
      for (let n = 1; n <= CELLS; n++) {
        // 1998: the listings were loaded from address.txt, which has "[ 35]" twice, so from 36
        // on every write landed on the line labelled one less.
        v.memoryLine(n, address(n));
        v.diskLine(n, address(n));
      }
    }

    clearTasks() {
      this.tasks = new Array(SLOTS + 1).fill(null);
    }

    count() {
      let c = 0;
      for (let i = 1; i <= SLOTS; i++) if (this.tasks[i]) c++;
      return c;
    }

    setTimer(on) {
      if (this.frozen && on) {
        this.resumeOnContinue = true;
        return;
      }
      if (this.timer !== on) {
        this.timer = on;
        this.view.timer(on);
      }
    }

    setQuantum(ms) {
      this.interval = ms;
      this.view.timer(this.timer);
    }

    freeze() {
      if (this.frozen) return;
      this.resumeOnContinue = this.timer;
      this.setTimer(false);
      this.frozen = true;
    }

    resume() {
      if (!this.frozen) return;
      this.frozen = false;
      if (this.resumeOnContinue) this.setTimer(true);
    }

    say(line) {
      this.view.screen(line);
    }

    // --------------------------------------------------------------------- the command line

    /** Execute: parse, do what is done on the spot, echo, queue or complain, blank line. */
    execute(input) {
      const p = parse(input, this.disk);
      this.accept(p);
      this.immediate(p);
      if (p.cmd !== NONE) this.say(p.cmd);
      if (p.code === 1) {
        this.setTimer(true);
        const e = echo(p);
        if (e !== null) this.say(e);
        this.queue(p);
      } else if (p.code !== 5) {
        this.say(ERRORS[p.code]);
      }
      this.say(' ');
      return p;
    }

    // The two lines the parser itself printed when a command was accepted.
    accept(p) {
      if (p.code !== 1) return;
      if (p.cmd === 'end') this.say('logging out...');
      else if (p.cmd === 'dir') this.say(' ');
    }

    // The commands that do not become tasks: edit, dirreal, dirtasks, terminate.
    immediate(p) {
      if (!p.kind) return;
      if (p.kind === 'edit') {
        this.say('Edit');
        if (p.code !== 5) return;
        this.say(p.file);
        // A name the directory does not have opens untitled.bch, under the name typed.
        let text = this.files.read(p.file);
        if (text === null) text = this.files.read('untitled.bch') || '';
        this.view.edit(p.file, text);
      } else if (p.kind === 'dirreal') {
        this.say('real dir');
        for (const name of this.files.list()) if (name !== 'untitled.bch') this.say(name);
      } else if (p.kind === 'dirtasks') {
        for (let i = 1; i <= SLOTS; i++) {
          const t = this.tasks[i];
          if (t) this.say(pad(t.cmd, 6) + ' ' + pad(t.remaining, 3) + ' ' + pad(t.p1, 15) + ' ' + pad(t.p2, 15) + ' ' + pad(t.number, 3));
        }
      } else if (p.kind === 'terminate' && p.code === 5) {
        for (let i = 1; i <= SLOTS; i++) {
          const t = this.tasks[i];
          if (t && t.number === p.number) {
            this.say(t.cmd + ' terminated at ' + t.remaining + ' time quantum before execution.');
            this.tasks[i] = null;
            this.view.remaining(0);
            this.view.current('');
            break;
          }
        }
      }
    }

    // The task-creation routine: first free slot, the next number, the command's quanta.
    queue(p) {
      for (let i = 1; i <= SLOTS; i++) {
        if (!this.tasks[i]) {
          const q = quanta(p);
          this.tasks[i] = { cmd: p.cmd, total: q, remaining: q, p1: p.b, p2: p.a, number: this.number++, line: -1 };
          return i;
        }
      }
      return 0;   // a full table dropped the command silently, then as now
    }

    /**
     * The batch editor's Execute buttons: if the file's name is not on the simulated disk yet,
     * queue a std that writes it there (100 quanta, so running it straight away still fails
     * until the write is done). Then the name goes on the command line for Execute.
     */
    storeBatch(name) {
      if (this.disk.indexOf(name) >= 0) return 0;
      // 1998: the address was the index of the first free task slot, whatever was stored there,
      // and was written without the space the other listings have ("[3]" rather than "[ 3]").
      let n = this.disk.indexOf(DISK_EMPTY);
      if (n < 0) n = 1;
      const slot = this.queue({ code: 1, cmd: 'std ', a: name, b: ' ' + n });
      if (slot) this.setTimer(true);
      return slot;
    }

    // ------------------------------------------------------------------------- the scheduler

    /** One timer tick: pick a task by the chosen algorithm and give it one quantum. */
    async tick() {
      this.view.active(this.count());
      const slot = this.pick();
      if (slot) await this.run(slot);
      // 1998: round robin's scan wrapped round an empty table for ever. The clock was switched
      // off when the last task finished, but `terminate` emptied the table without doing so, and
      // the next tick hung the program at full CPU (checked under Wine: terminate the only task).
      else if (this.algorithm === ROUND_ROBIN) this.setTimer(false);
    }

    pick() {
      const t = this.tasks;
      let best = 0;
      if (this.algorithm === FIFO) {
        // Lowest task number: the oldest command still in the table.
        for (let i = 1; i <= SLOTS; i++) if (t[i] && (!best || t[i].number < t[best].number)) best = i;
      } else if (this.algorithm === SJF) {
        // Least remaining time, rescanned every quantum, so a short command overtakes a long one
        // already running: shortest remaining time first, preemptive. Ties go to the lower slot.
        for (let i = 1; i <= SLOTS; i++) if (t[i] && t[i].remaining > 0 && (!best || t[i].remaining < t[best].remaining)) best = i;
      } else {
        // The next occupied slot after the one that ran last, wrapping round.
        for (let k = 1; k <= SLOTS && !best; k++) {
          const i = ((this.lastRoundRobin + k - 1) % SLOTS) + 1;
          if (t[i]) best = i;
        }
        if (best) this.lastRoundRobin = best;
      }
      return best;
    }

    // execute_task
    async run(slot) {
      const t = this.tasks[slot];
      t.remaining--;
      this.view.current(t.cmd);
      this.view.remaining(t.remaining);
      if (t.remaining === 0) {
        if (t.cmd === 'Run Batch') await this.stepBatch(slot, t);
        else await this.complete(slot, t);
        this.say(' ');
      }
      if (this.count() === 0) {
        this.clearTasks();
        if (this.algorithm === ROUND_ROBIN) this.setTimer(false);
        this.view.active(0);
        this.view.current('');
        this.view.remaining(0);
      }
    }

    async complete(slot, t) {
      await this.effect(t.cmd, t.p2, t.p1);
      if (t.cmd === 'Run Batch Separately') {
        this.tasks[slot] = null;
        this.say(' ');
        const ls = this.batchLines(t.p2);
        if (!ls) return;
        const err = this.check(ls);
        if (err) {
          err.forEach((l) => this.say(l));
          return;
        }
        // Each line as if typed, without the echo. 1998: the first line was queued twice and the
        // batch's own record was written back over the first task queued; the two cancelled out
        // when the batch sat in the first free slot, and a later line was lost when it did not.
        for (const l of ls) {
          const p = parse(l, this.disk);
          this.accept(p);
          if (p.code === 1) this.queue(p);
          else this.immediate(p);
        }
        return;
      }
      this.tasks[slot] = null;
    }

    /** "Execute as one": the whole file is one task that runs its lines in turn. */
    async stepBatch(slot, t) {
      const ls = this.batchLines(t.p2);
      if (!ls) {
        this.tasks[slot] = null;
        return;
      }
      if (t.line < 0) {
        // The first 5 quanta are up: check every line, then load the first one's time.
        const err = this.check(ls);
        if (err) {
          err.forEach((l) => this.say(l));
          this.tasks[slot] = null;
          return;
        }
        t.line = 0;
        this.load(t, ls[0]);
        return;
      }
      const p = parse(ls[t.line++], this.disk);
      if (p.code === 5) this.immediate(p);
      else await this.effect(p.cmd, p.a, p.b);
      if (t.line >= ls.length || !this.tasks[slot]) this.tasks[slot] = null;
      else this.load(t, ls[t.line]);
    }

    load(t, line) {
      const p = parse(line, this.disk);
      this.accept(p);
      t.total = t.remaining = quanta(p);
    }

    batchLines(name) {
      const text = this.files.read(name);
      if (text === null) {
        // 1998: an I/O exception out of the timer ('File not found'), and a task stuck forever.
        this.view.alert('Error', 'File not found');
        return null;
      }
      return lines(text);
    }

    /** Every line must parse and none may run another batch. Silent, unlike 1998's check. */
    check(ls) {
      for (let i = 0; i < ls.length; i++) {
        const p = parse(ls[i], this.disk);
        // 1998: "line" was FilePos on a text file, the 128-byte buffer count, so always 1 here.
        if (ERRORS[p.code]) return ['Error of Type: ' + ERRORS[p.code] + ' occured in line ' + (i + 1)];
        if (p.cmd === 'Run Batch' || p.cmd === 'Run Batch Separately') {
          return [
            'Error of Type: You are not allowed to call a batch file from inside a batchfile! occured in line ' + (i + 1),
            'Try again in the next version of OSS!'
          ];
        }
      }
      return null;
    }

    // What a finished command does. `a` is the text or the address, `b` the address of stm/std
    // and the first string of cmp.
    async effect(cmd, a, b) {
      const v = this.view;
      switch (cmd) {
        case 'cmp ': {
          const c = compare(b, a);
          if (c < 0) this.say('H:' + a + ' L:' + b);
          if (c > 0) this.say('H:' + b + ' L:' + a);
          if (c === 0) this.say('Equal operands!');
          break;
        }
        case 'scr ':
          this.say(a);
          break;
        case 'prn ':
          v.printer('printing completed');
          v.printer(a);
          break;
        case 'stm ':
          await this.store(this.memory, MEMORY_EMPTY, val(b), a, (n, s) => v.memoryLine(n, s));
          break;
        case 'std ':
          await this.store(this.disk, DISK_EMPTY, val(b), a, (n, s) => v.diskLine(n, s));
          break;
        case 'ldm ':
          this.say(this.memory[val(a)]);
          break;
        case 'ldd ':
          this.say(this.disk[val(a)]);
          break;
        case 'dlm ': {
          const n = val(a);
          this.memory[n] = MEMORY_EMPTY;
          v.memoryLine(n, address(n));
          break;
        }
        case 'dld ': {
          const n = val(a);
          this.disk[n] = DISK_EMPTY;
          v.diskLine(n, address(n));
          break;
        }
        case 'dir':
          for (let n = 1; n <= CELLS; n++) if (lower(this.disk[n].slice(-4)) === '.bch') this.say(this.disk[n]);
          break;
        case 'end':
          this.setTimer(false);
          v.logout();
          break;
      }
    }

    // stm and std: an occupied address asks first, with the timer stopped while it asks.
    async store(cells, empty, n, text, show) {
      if (cells[n] !== empty) {
        this.setTimer(false);
        const yes = await this.view.confirm('Warning', OVERWRITE);
        if (!yes) this.say('Command aborted due to occupied address!');
        this.setTimer(true);
        if (!yes) return;
      }
      cells[n] = text;
      show(n, address(n) + ' "' + text + '"');
    }
  }

  // Everything a view may implement; the simulator calls these and nothing else.
  const NullView = {
    clear() {},                         // the Screen memo emptied (Reset)
    screen(line) {},                    // a line added to the Screen
    printer(line) {},                   // a line added to the Printer Status panel
    memoryLine(n, text) {},             // memory listing, line n
    diskLine(n, text) {},               // hard-disk listing, line n
    active(n) {},                       // Active Tasks
    current(cmd) {},                    // Current Task
    remaining(n) {},                    // Rem.Time
    timer(on) {},                       // Timer1 enabled or not (interval in sim.interval)
    confirm(caption, message) { return Promise.resolve(true); },
    alert(caption, message) {},
    edit(name, text) {},                // the batch editor opened on a file
    logout() {}                         // `end`: back to the login window
  };

  // A directory held in memory, for tests and for a page without storage.
  function memoryFiles(initial) {
    const map = new Map(Object.entries(initial || {}));
    return {
      read: (name) => (map.has(name) ? map.get(name) : null),
      write: (name, text) => void map.set(name, text),
      list: () => [...map.keys()].sort()
    };
  }

  // The two batch files the zip shipped, byte for byte (example.bch has no final newline;
  // untitled.bch is empty and is what `edit` opens for a name the directory does not have).
  const SHIPPED_FILES = {
    'example.bch': 'std 5 this is an example\r\nldd 5\r\nstm 12 of a batch file\r\nldm 12\r\nscr batch file example',
    'untitled.bch': ''
  };

  return {
    Simulator, parse, squeeze, val, lower, memoryFiles, SHIPPED_FILES, QUANTA, ERRORS,
    FIFO, ROUND_ROBIN, SJF
  };
});
