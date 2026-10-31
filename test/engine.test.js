// node --test: the engine against what the 1998 program printed when it was run under Wine,
// and the schedulers, batches and dialogs that a session like that exercises.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

function boot(options = {}) {
  const out = { screen: [], printer: [], memory: {}, disk: {}, confirms: [], alerts: [], edits: [], logouts: 0 };
  const view = {
    clear: () => (out.screen = []),
    screen: (l) => out.screen.push(l),
    printer: (l) => out.printer.push(l),
    memoryLine: (n, t) => (out.memory[n] = t),
    diskLine: (n, t) => (out.disk[n] = t),
    confirm: (c, m) => {
      out.confirms.push(m);
      return Promise.resolve(options.answer !== undefined ? options.answer : true);
    },
    alert: (c, m) => out.alerts.push(m),
    edit: (name, text) => out.edits.push([name, text]),
    logout: () => out.logouts++
  };
  const sim = new E.Simulator(view, E.memoryFiles(options.files || E.SHIPPED_FILES));
  sim.login('bkarak', options.algorithm || E.FIFO);
  out.screen = [];
  return { sim, out };
}

async function ticks(sim, n) {
  for (let i = 0; i < n; i++) await sim.tick();
}

// The non-blank screen lines, trimmed: what a reader would call the output.
function said(out) {
  return out.screen.filter((l) => l.trim()).map((l) => l.trim());
}

// Run until the table is empty, returning how many quanta that took.
async function drain(sim, limit = 5000) {
  let n = 0;
  while (sim.count() > 0 && n < limit) {
    await sim.tick();
    n++;
  }
  return n;
}

test('squeeze collapses the first runs of spaces and keeps the rest', () => {
  assert.equal(E.squeeze(1, '   ldm    12'), 'ldm 12');
  assert.equal(E.squeeze(2, 'stm   12    two   spaces'), 'stm 12 two   spaces');
});

test('val is System.Val: leading spaces, sign, $ hex, nothing trailing', () => {
  assert.equal(E.val(' 12'), 12);
  assert.equal(E.val('$1f'), 31);
  assert.equal(E.val('-3'), -3);
  assert.ok(Number.isNaN(E.val('12 ')));
  assert.ok(Number.isNaN(E.val('abc')));
  assert.ok(Number.isNaN(E.val(' ')));
});

test('scr echoes, lowercases, and prints again five quanta later (as under Wine)', async () => {
  const { sim, out } = boot();
  sim.execute('scr Hello World');
  assert.deepEqual(out.screen, ['scr ', ' hello world', ' ']);
  await ticks(sim, 4);
  assert.equal(out.screen.length, 3);
  await ticks(sim, 1);
  assert.deepEqual(out.screen.slice(3), [' hello world', ' ']);
});

test('stm, cmp and the memory listing match the original', async () => {
  const { sim, out } = boot();
  sim.execute('stm 5 Abc');
  assert.deepEqual(out.screen, ['stm ', ' 5 abc', ' ']);
  await ticks(sim, 1);
  assert.equal(out.memory[5], '[ 5] "abc"');
  out.screen = [];
  sim.execute('cmp /abc /abd');
  assert.deepEqual(out.screen, ['cmp ', 'abc abd', ' ']);
  await ticks(sim, 1);
  assert.deepEqual(out.screen.slice(3), ['H:abd L:abc', ' ']);
});

test('dirtasks prints the %6s %3d %15s %15s %3d row', async () => {
  const { sim, out } = boot();
  sim.number = 9;
  sim.execute('prn hi there');
  await ticks(sim, 17);
  out.screen = [];
  sim.execute('dirtasks');
  // Copied from the Wine screenshot of the original, which wraps it in the memo.
  assert.equal(out.screen[0], '  prn  483            none        hi there   9');
});

test('fixed: unknown three- and six-letter commands are not batch files', () => {
  const { sim, out } = boot();
  sim.execute('foo');
  sim.execute('foobar');
  assert.deepEqual(out.screen, ['Invalid or Misspelled Command!', ' ', 'Invalid or Misspelled Command!', ' ']);
});

test('fixed: addresses are range-checked and non-numbers get one message', () => {
  const { sim, out } = boot();
  for (const c of ['ldm 0', 'ldd 101', 'dlm -1', 'stm 0 x', 'ldm x', 'dld x', 'stm x y']) sim.execute(c);
  const errors = out.screen.filter((l) => l.endsWith('!'));
  assert.deepEqual(errors, [
    'Incorrect Memory Position Selected!', 'Incorrect Memory Position Selected!',
    'Incorrect Memory Position Selected!', 'Incorrect Memory Position Selected!',
    'Misspelled or Missing Parameters!', 'Misspelled or Missing Parameters!',
    'Misspelled or Missing Parameters!'
  ]);
  assert.equal(sim.count(), 0);
});

test('dir lists the batch files on the simulated disk, five quanta later', async () => {
  const { sim, out } = boot();
  sim.execute('std 7 Example.bch');
  await drain(sim);
  out.screen = [];
  sim.execute('dir');
  assert.deepEqual(out.screen, [' ', 'dir', ' ']);
  await drain(sim);
  assert.deepEqual(out.screen.slice(3), ['example.bch', ' ']);
});

test('a batch must be on the simulated disk before it runs', () => {
  const { sim, out } = boot();
  sim.execute('example.bch');
  assert.deepEqual(out.screen, ['Run Batch', 'Specified Batch File Missing from Virtual Hard Drive', ' ']);
});

test('example.bch /s prints what the original printed under Wine', async () => {
  const { sim, out } = boot();
  sim.execute('std 1 example.bch');
  await drain(sim);
  out.screen = [];
  sim.execute('example.bch /s');
  const n = await drain(sim);
  assert.deepEqual(out.screen, [
    'Run Batch Separately', 'example.bch', ' ',
    ' ', ' ',                        // the batch's own five quanta end
    ' ',                             // std 5
    'this is an example', ' ',       // ldd 5
    ' ',                             // stm 12
    'of a batch file', ' ',          // ldm 12
    ' batch file example', ' '       // scr
  ]);
  assert.equal(n, 5 + 100 + 100 + 1 + 1 + 5);
  assert.equal(out.confirms.length, 0, 'the first line runs once, so std 5 never finds 5 occupied');
  assert.equal(out.disk[5], '[ 5] "this is an example"');
  assert.equal(out.memory[12], '[ 12] "of a batch file"');
});

test('example.bch as one task takes 5 plus every line, in order', async () => {
  const { sim, out } = boot();
  sim.execute('std 1 example.bch');
  await drain(sim);
  out.screen = [];
  sim.execute('example.bch');
  assert.equal(sim.count(), 1);
  const n = await drain(sim);
  assert.equal(n, 5 + 100 + 100 + 1 + 1 + 5);
  assert.deepEqual(said(out), ['Run Batch', 'example.bch', 'this is an example', 'of a batch file', 'batch file example']);
});

test('a batch is checked line by line before it runs, and says where it failed', async () => {
  const files = { 'bad.bch': 'scr fine\r\nfrobnicate\r\n', 'nest.bch': 'scr a\r\nbad.bch\r\n' };
  const { sim, out } = boot({ files });
  sim.execute('std 1 bad.bch');
  sim.execute('std 2 nest.bch');
  await drain(sim);
  out.screen = [];
  sim.execute('bad.bch');
  await drain(sim);
  assert.ok(out.screen.includes('Error of Type: Invalid or Misspelled Command! occured in line 2'));
  out.screen = [];
  sim.execute('nest.bch /s');
  await drain(sim);
  assert.ok(out.screen.includes('Error of Type: You are not allowed to call a batch file from inside a batchfile! occured in line 2'));
  assert.ok(out.screen.includes('Try again in the next version of OSS!'));
  assert.equal(sim.count(), 0);
});

test('FIFO runs commands in the order they were given', async () => {
  const { sim, out } = boot({ algorithm: E.FIFO });
  sim.execute('scr a');
  sim.execute('scr b');
  sim.execute('cmp /x /y');
  out.screen = [];
  await drain(sim);
  assert.deepEqual(said(out), ['a', 'b', 'H:y L:x']);
});

test('Round robin gives each task one quantum in turn', async () => {
  const { sim, out } = boot({ algorithm: E.ROUND_ROBIN });
  sim.execute('scr a');
  sim.execute('scr b');
  sim.execute('cmp /x /y');
  out.screen = [];
  await ticks(sim, 3);
  assert.deepEqual(said(out), ['H:y L:x']);
  await drain(sim);
  assert.deepEqual(said(out), ['H:y L:x', 'a', 'b']);
  assert.equal(sim.timer, false, 'round robin stops the timer when the table empties');
});

test('Shortest job first lets a short command overtake a long one already running', async () => {
  const { sim, out } = boot({ algorithm: E.SJF });
  sim.execute('ldd 1');          // 100 quanta
  await ticks(sim, 10);
  sim.execute('scr quick');      // 5 quanta
  out.screen = [];
  await ticks(sim, 5);
  assert.deepEqual(said(out), ['quick']);
  assert.equal(sim.tasks.filter(Boolean)[0].remaining, 90);
});

test('terminate removes a task by number and says how far it got', async () => {
  const { sim, out } = boot();
  sim.execute('prn long job');
  await ticks(sim, 20);
  out.screen = [];
  sim.execute('terminate 1');
  assert.deepEqual(out.screen, ['prn  terminated at 480 time quantum before execution.', ' ']);
  assert.equal(sim.count(), 0);
});

test('an occupied address asks first, and No aborts', async () => {
  const { sim, out } = boot({ answer: false });
  sim.execute('stm 3 first');
  sim.execute('stm 3 second');
  await drain(sim);
  assert.equal(out.confirms.length, 1);
  assert.ok(out.screen.includes('Command aborted due to occupied address!'));
  assert.equal(out.memory[3], '[ 3] "first"');
});

test('the editor queues the file onto the disk; running it before the write is done fails', async () => {
  const { sim, out } = boot();
  sim.execute('edit example.bch');
  assert.deepEqual(out.edits[0], ['example.bch', E.SHIPPED_FILES['example.bch']]);
  sim.storeBatch('example.bch');
  out.screen = [];
  sim.execute('example.bch');
  assert.ok(out.screen.includes('Specified Batch File Missing from Virtual Hard Drive'));
  await drain(sim);
  assert.equal(out.disk[1], '[ 1] "example.bch"');
  out.screen = [];
  sim.execute('example.bch');
  assert.equal(sim.count(), 1);
});

test('edit opens untitled.bch for a new name and refuses other extensions', () => {
  const { sim, out } = boot();
  sim.execute('edit new.bch');
  assert.deepEqual(out.edits[0], ['new.bch', '']);
  out.screen = [];
  sim.execute('edit notes.txt');
  assert.deepEqual(out.screen, ['Edit', 'Invalid Filename!', ' ']);
});

test('end logs out after one quantum', async () => {
  const { sim, out } = boot();
  sim.execute('end');
  assert.deepEqual(out.screen, ['logging out...', 'end', ' ']);
  await ticks(sim, 1);
  assert.equal(out.logouts, 1);
});

test('Freeze holds the clock and Continue restarts it', () => {
  const { sim } = boot();
  sim.execute('scr x');
  assert.equal(sim.timer, true);
  sim.freeze();
  assert.equal(sim.timer, false);
  sim.storeBatch('example.bch');
  assert.equal(sim.timer, false, 'nothing starts the clock while frozen');
  sim.resume();
  assert.equal(sim.timer, true);
});

test('task numbers keep counting across Reset, as Execute.Tag did', () => {
  const { sim } = boot();
  sim.execute('scr a');
  sim.reset();
  sim.execute('scr b');
  assert.equal(sim.tasks.filter(Boolean)[0].number, 2);
});

test('fixed: terminating the last task under round robin does not hang the clock', async () => {
  const { sim, out } = boot({ algorithm: E.ROUND_ROBIN });
  sim.execute('prn x');
  await ticks(sim, 3);
  sim.execute('terminate 1');
  assert.equal(sim.count(), 0);
  await ticks(sim, 1);
  assert.equal(sim.timer, false);
  out.screen = [];
  sim.execute('scr still alive');
  await drain(sim);
  assert.deepEqual(said(out), ['scr', 'still alive', 'still alive']);
});
