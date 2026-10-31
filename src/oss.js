/*
 * OSS on a 640x480 Windows 95 desktop: the four forms of Os_simulator.exe rebuilt from their
 * Delphi form files (docs/forms), wired to engine.js. The forms were laid out for 640x480 —
 * the login window's design-time position, 55,55, is exactly its centred position on that
 * screen — so the desktop is that size and the page scales it to fit.
 *
 * Needs engine.js and help.js loaded first. window.OSS is a handle for poking at it from the
 * console (OSS.sim is the engine); the page itself never reads it.
 */
(function () {
  'use strict';

  const E = window.OSSEngine;
  const HELP = window.OSSHelp;
  const DESK_W = 640;
  const DESK_H = 480;
  const CAPTION = 16;
  const MENU = 19;
  const FRAME = 3;

  // ------------------------------------------------------------------------------- helpers

  function el(tag, cls, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  function place(n, x, y, w, h) {
    n.style.left = x + 'px';
    n.style.top = y + 'px';
    if (w !== undefined) n.style.width = w + 'px';
    if (h !== undefined) n.style.height = h + 'px';
    return n;
  }

  // "E&xecute as one" -> E<u>x</u>ecute as one, the way Windows drew an accelerator.
  function accel(n, caption) {
    const i = caption.indexOf('&');
    n.textContent = '';
    if (i < 0) {
      n.textContent = caption;
      return n;
    }
    n.append(caption.slice(0, i));
    el('u', '', n).textContent = caption[i + 1];
    n.append(caption.slice(i + 2));
    return n;
  }

  function button(parent, caption, x, y, w, h, onClick, title) {
    const b = place(el('button', '', parent), x, y, w, h);
    b.type = 'button';
    accel(b, caption);
    if (title) b.title = title;
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function label(parent, text, x, y, cls) {
    const l = place(el('div', 'label ' + (cls || ''), parent), x, y);
    l.textContent = text;
    return l;
  }

  function input(parent, x, y, w, h, opts) {
    const i = place(el('input', '', parent), x, y, w, h);
    i.type = 'text';
    i.spellcheck = false;
    i.autocomplete = 'off';
    if (opts && opts.readOnly) i.readOnly = true;
    if (opts && opts.value !== undefined) i.value = opts.value;
    if (opts && opts.maxLength) i.maxLength = opts.maxLength;
    if (opts && opts.title) i.title = opts.title;
    return i;
  }

  // A read-only TMemo: one <div> per line, so a listing can replace line n in place.
  function memo(parent, x, y, w, h, font) {
    const m = place(el('div', 'memo', parent), x, y, w, h);
    if (font) m.style.font = font;
    return {
      node: m,
      add(line) {
        const d = el('div', '', m);
        d.textContent = line;
        while (m.childNodes.length > 2000) m.removeChild(m.firstChild);
        m.scrollTop = m.scrollHeight;
      },
      set(n, line) {
        while (m.childNodes.length < n) el('div', '', m);
        m.childNodes[n - 1].textContent = line;
      },
      clear() {
        m.textContent = '';
      }
    };
  }

  function bevel(parent, x, y, w, h, raised) {
    return place(el('div', 'bevel' + (raised ? ' raised' : ''), parent), x, y, w, h);
  }

  // ------------------------------------------------------------------------ the desktop

  const stage = document.querySelector('.oss-stage');
  const desk = el('div', 'oss-desktop', stage);
  let zTop = 10;
  let modal = 0;

  function fit() {
    const maxScale = parseFloat(stage.dataset.maxScale || '4');
    const s = Math.min(stage.clientWidth / DESK_W, stage.clientHeight / DESK_H, maxScale);
    desk.style.transform = 'scale(' + s + ')';
    desk.style.left = Math.max(0, (stage.clientWidth - DESK_W * s) / 2) + 'px';
    desk.style.top = Math.max(0, (stage.clientHeight - DESK_H * s) / 2) + 'px';
    desk.dataset.scale = s;
  }
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);

  // A tool window (BorderStyle = bsToolWindow, as all four forms were). x/y are the window's
  // outer position; w/h are the form's ClientWidth/ClientHeight.
  function makeWindow(opts) {
    const w = el('div', 'win ' + (opts.cls || ''), desk);
    const outerW = opts.w + 2 * FRAME;
    const outerH = opts.h + 2 * FRAME + CAPTION + (opts.menu ? MENU : 0);
    const x = opts.x !== undefined ? opts.x : Math.round((DESK_W - outerW) / 2);
    const y = opts.y !== undefined ? opts.y : Math.round((DESK_H - outerH) / 2);
    place(w, x, y, outerW, outerH);
    w.hidden = true;
    const cap = el('div', 'caption', w);
    el('span', '', cap).textContent = opts.title;
    if (opts.onClose) {
      const c = el('button', 'close', cap);
      c.type = 'button';
      c.textContent = '×';
      c.title = 'Close';
      c.addEventListener('click', opts.onClose);
    }
    drag(cap, w);
    let bar = null;
    if (opts.menu) bar = menubar(w, opts.menu);
    const client = place(el('div', 'client', w), 0, 0, opts.w, opts.h);
    client.style.position = 'relative';
    w.addEventListener('pointerdown', () => activate(w), true);
    const win = {
      node: w,
      client,
      bar,
      setTitle(t) {
        cap.firstChild.textContent = t;
      },
      show() {
        w.hidden = false;
        activate(w);
      },
      hide() {
        w.hidden = true;
        const rest = [...desk.querySelectorAll('.win:not([hidden])')].sort((a, b) => b.style.zIndex - a.style.zIndex);
        if (rest[0]) activate(rest[0]);
      },
      get visible() {
        return !w.hidden;
      }
    };
    return win;
  }

  function activate(w) {
    for (const o of desk.querySelectorAll('.win.active')) o.classList.remove('active');
    w.classList.add('active');
    if (!w.classList.contains('msgbox')) w.style.zIndex = ++zTop;
    else w.style.zIndex = 1000 + modal;
  }

  function drag(handle, w) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const s = parseFloat(desk.dataset.scale) || 1;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const l0 = parseFloat(w.style.left);
      const t0 = parseFloat(w.style.top);
      const move = (m) => {
        const nx = Math.min(DESK_W - 40, Math.max(-w.offsetWidth + 40, l0 + (m.clientX - x0) / s));
        const ny = Math.min(DESK_H - 20, Math.max(0, t0 + (m.clientY - y0) / s));
        w.style.left = nx + 'px';
        w.style.top = ny + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  // A main menu: [{ caption: '&File', items: [{ caption, shortcut, run, id } | '-'] }].
  let openMenu = null;
  function closeMenus() {
    if (!openMenu) return;
    openMenu.drop.remove();
    openMenu.top.classList.remove('open');
    openMenu = null;
  }
  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !e.target.closest('.menu-drop') && !e.target.closest('.menu-top')) closeMenus();
  });

  function menubar(w, menus) {
    const bar = el('div', 'menubar', w);
    const items = {};
    for (const m of menus) {
      const top = el('div', 'menu-top', bar);
      accel(top, m.caption);
      top.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (openMenu && openMenu.top === top) return closeMenus();
        closeMenus();
        const drop = el('div', 'menu-drop', w);
        drop.style.left = top.offsetLeft + FRAME + 'px';
        drop.style.top = FRAME + CAPTION + MENU + 'px';
        for (const it of m.items) {
          if (it === '-') {
            el('div', 'sep', drop);
            continue;
          }
          const row = el('div', 'item' + (it.disabled ? ' disabled' : ''), drop);
          accel(el('span', '', row), it.caption);
          el('span', '', row).textContent = it.shortcut || '';
          row.addEventListener('click', () => {
            if (it.disabled) return;
            closeMenus();
            if (it.run) it.run();
          });
        }
        top.classList.add('open');
        openMenu = { top, drop };
      });
      for (const it of m.items) if (it !== '-' && it.id) items[it.id] = it;
    }
    return items;
  }

  // ------------------------------------------------------------------------- message boxes

  const ICONS = {
    Warning:
      '<svg width="32" height="32" viewBox="0 0 32 32"><path d="M16 2 31 29H1z" fill="#ff0" stroke="#000" stroke-width="1.5"/><rect x="14.5" y="10" width="3" height="11" fill="#000"/><rect x="14.5" y="23" width="3" height="3" fill="#000"/></svg>',
    Error:
      '<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#f00" stroke="#800000" stroke-width="1.5"/><path d="M10 10l12 12M22 10 10 22" stroke="#fff" stroke-width="3.5"/></svg>',
    Information:
      '<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000080" stroke-width="1.5"/><rect x="14.5" y="13" width="3" height="11" fill="#000080"/><rect x="14.5" y="7" width="3" height="3" fill="#000080"/></svg>'
  };

  // MessageDlg. Resolves with the button pressed ('Yes', 'No', 'OK').
  function messageBox(caption, text, buttons) {
    return new Promise((resolve) => {
      modal++;
      const veil = el('div', 'modal-veil', desk);
      veil.style.zIndex = 999 + modal;
      const w = el('div', 'win msgbox active', desk);
      w.style.zIndex = 1000 + modal;
      const cap = el('div', 'caption', w);
      el('span', '', cap).textContent = caption;
      const client = el('div', 'client', w);
      const body = el('div', 'body', client);
      const icon = el('div', '', body);
      icon.innerHTML = ICONS[caption] || ICONS.Information;
      el('div', '', body).textContent = text;
      const row = el('div', 'buttons', client);
      const prior = document.activeElement;
      const done = (b) => {
        w.remove();
        veil.remove();
        modal--;
        document.removeEventListener('keydown', key, true);
        resolve(b);
      };
      const btns = buttons.map((b) => {
        const n = el('button', '', row);
        n.type = 'button';
        accel(n, b === 'OK' ? 'OK' : '&' + b);
        n.addEventListener('click', () => done(b));
        return n;
      });
      const key = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          done(buttons[buttons.length - 1]);
        } else if (e.key === 'y' && buttons.includes('Yes')) done('Yes');
        else if (e.key === 'n' && buttons.includes('No')) done('No');
      };
      document.addEventListener('keydown', key, true);
      // Centre on the desktop once it has a size.
      w.style.visibility = 'hidden';
      requestAnimationFrame(() => {
        place(w, Math.round((DESK_W - w.offsetWidth) / 2), Math.round((DESK_H - w.offsetHeight) / 2));
        w.style.visibility = '';
        btns[0].focus();
      });
      void prior;
    });
  }

  // ---------------------------------------------------------------- the real hard drive

  // The directory the 1998 program ran in, where `edit`, Open, Save As, dirreal and the batch
  // runner found their .bch files. Here it is this browser's storage, seeded with the two files
  // the zip shipped; without storage it lives as long as the page.
  const STORE = 'oss.files';
  function realDisk() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORE));
    } catch (e) {
      data = null;
    }
    if (!data || typeof data !== 'object') data = Object.assign({}, E.SHIPPED_FILES);
    const save = () => {
      try {
        localStorage.setItem(STORE, JSON.stringify(data));
      } catch (e) {
        /* private window or storage off: the directory lasts as long as the page */
      }
    };
    save();
    return {
      read: (name) => (Object.prototype.hasOwnProperty.call(data, name) ? data[name] : null),
      write: (name, text) => {
        data[name] = text;
        save();
      },
      list: () => Object.keys(data).sort()
    };
  }
  const files = realDisk();

  // ------------------------------------------------------------------------- login form

  const login = makeWindow({ title: 'Welcome To OS-Simulator', w: 524, h: 348, x: 55, y: 55, onClose: shutDown });
  const L = login.client;
  label(L, 'Enter Login Here:', 16, 44, 'term');
  const group = place(el('div', 'groupbox', L), 184, 24, 185, 89);
  group.title = 'Choose a sheduler Here';
  el('span', 'legend', group).textContent = 'Choose Scheduler';
  const radios = ['Fifo', 'Round-Robin', 'Shortest Job First'].map((t, i) => {
    const lab = el('label', '', group);
    lab.style.top = 17 + 23 * i + 'px';
    const r = el('input', '', lab);
    r.type = 'radio';
    r.name = 'oss-scheduler';
    r.value = String(i);
    lab.append(t);
    return r;
  });
  const loginName = input(L, 16, 64, 145, 21, { title: 'Enter Your Name Here' });
  const status = memo(L, 16, 136, 489, 177, '11px var(--term)');
  status.node.title = 'Status';
  const startBtn = button(L, 'Start The Simulation', 392, 56, 113, 25, start, 'Enter The Simulation');
  const progress = place(el('div', 'progress', L), 16, 320, 489, 16);
  const bar = el('i', '', progress);
  loginName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') start();
  });

  // TLogin.FormActivate
  function showLogin() {
    radios[0].checked = true;
    loginName.value = '';
    status.clear();
    bar.style.width = '0';
    startBtn.disabled = false;
    login.show();
    loginName.focus();
  }

  function algorithm() {
    const r = radios.find((x) => x.checked);
    return r ? Number(r.value) : -1;
  }

  // What GetSystemInfo and GlobalMemoryStatus tell this 1998 program on a PC of today: a
  // 32-bit process sees the processors (up to 32) and memory capped at 2 GB, so both memory
  // lines read 2147483647. A browser exposes the processor count and nothing else, and every
  // machine that runs one has more than 2 GB, so these are the figures the original prints.
  function machine() {
    const cap = 2147483647;
    return { processors: Math.min(32, navigator.hardwareConcurrency || 1), physical: [cap, cap], swap: [cap, cap], granularity: 65536 };
  }

  // The lines the detection loop printed, and the progress-bar position each came after.
  // 1998: the loop never let Windows paint, so the text was never seen; the bar moved and the
  // window closed. The help file describes what was meant, and that is what this shows.
  function start() {
    if (startBtn.disabled) return;
    const name = loginName.value;
    if (name === '') {
      status.add('Please Enter a Login First..');
      loginName.focus();
      return;
    }
    const algo = algorithm();
    if (name === 'over') return enter(name, algo); // the team's shortcut past the detection
    const ln = sim.detection(algo, machine());
    const at = algo >= 0 ? 1 : 0;
    const steps = [
      [0, ln.slice(0, at)],
      [2000, ln.slice(at, at + 6)],
      [4000, ln.slice(at + 6, at + 7)],
      [6000, ln.slice(at + 7, at + 9)],
      [7500, ln.slice(at + 9)],
      [9000, []]
    ];
    status.clear();
    startBtn.disabled = true;
    const t0 = performance.now();
    const total = 3000;
    let shown = 0;
    const frame = () => {
      const pos = Math.min(9000, ((performance.now() - t0) / total) * 9000);
      bar.style.width = (pos / 9000) * 100 + '%';
      while (shown < steps.length && pos >= steps[shown][0]) steps[shown++][1].forEach((l) => status.add(l));
      if (pos < 9000) setTimeout(frame, 16);
      else setTimeout(() => enter(name, algo), 400);
    };
    frame();
  }

  function enter(name, algo) {
    login.hide();
    showMain(name, algo < 0 ? E.FIFO : algo);
  }

  // ------------------------------------------------------------------------- main form

  const main = makeWindow({
    title: 'Simulation Screen',
    w: 618,
    h: 403,
    x: 8,
    y: 2,
    menu: [
      {
        caption: '&File',
        items: [
          { caption: 'Help Contents', run: () => help('contents') },
          { caption: 'About...', run: about },
          '-',
          { caption: 'E&xit', shortcut: 'Ctrl+X', run: shutDown }
        ]
      },
      {
        caption: '&Options',
        items: [
          { caption: 'Execute', id: 'execute', run: execute },
          { caption: 'Freeze', id: 'freeze', run: freeze },
          { caption: 'Reset', id: 'reset', run: reset },
          '-',
          { caption: 'Memory', run: () => panel('memory') },
          { caption: 'HDD', run: () => panel('disk') },
          { caption: 'Printer', run: () => panel('printer') }
        ]
      }
    ]
  });
  const M = main.client;
  bevel(M, 304, 0, 305, 393);
  bevel(M, 312, 104, 289, 249, true);
  bevel(M, 8, 0, 289, 393);
  label(M, 'Screen:', 24, 8, 'sys').style.fontSize = '13px';
  label(M, 'Command Line:', 24, 312, 'plain');
  label(M, 'Active Tasks:', 320, 8, 'sys');
  label(M, 'Current Task:', 320, 40, 'sys');
  label(M, 'Rem.Time:', 456, 8, 'sys');
  label(M, 'Time Quantum(milisecs):', 320, 72, 'sys');

  const panels = {};
  function devicePanel(key, title, size, x) {
    const p = place(el('div', '', M), 320, 144, 273, 201);
    const t = label(p, title, x, key === 'disk' ? 1 : 0, 'sys');
    t.style.fontSize = size + 'px';
    t.style.lineHeight = '16px';
    const m = memo(p, 0, 16, 273, 185);
    panels[key] = { node: p, memo: m };
    return m;
  }
  const memoryList = devicePanel('memory', 'Memory:', 19, 0);
  const diskList = devicePanel('disk', 'Hard Disk:', 11, 0);
  const printerList = devicePanel('printer', 'Printer Status:', 13, 13);
  function panel(key) {
    for (const k of Object.keys(panels)) panels[k].node.hidden = k !== key;
  }
  panel('printer');

  const screen = memo(M, 24, 24, 257, 281, '12px Arial, Helvetica, sans-serif');
  const cmd = input(M, 24, 328, 257, 21);
  const executeBtn = button(M, 'Execute', 24, 360, 73, 25, execute);
  const freezeBtn = button(M, 'Freeze', 112, 360, 81, 25, freeze);
  const resetBtn = button(M, 'Reset', 208, 360, 75, 25, reset);
  button(M, 'Exit To Windows', 344, 360, 89, 25, shutDown);
  button(M, 'Help', 480, 360, 89, 25, () => help('contents'));
  const activeField = input(M, 416, 8, 25, 21, { readOnly: true, value: '0' });
  const remainingField = input(M, 528, 8, 65, 21, { readOnly: true });
  const currentField = input(M, 416, 40, 177, 21, { readOnly: true });
  const quantumField = input(M, 488, 72, 105, 21, { maxLength: 10, value: '100' });
  button(M, 'Memory', 328, 112, 73, 25, () => panel('memory'));
  button(M, 'HDD', 416, 112, 81, 25, () => panel('disk'));
  button(M, 'Printer', 512, 112, 73, 25, () => panel('printer'));

  // Edit1Change: a command line that is just a space empties itself.
  cmd.addEventListener('input', () => {
    if (cmd.value === ' ') cmd.value = '';
  });
  // Enter runs the command. 1998: only the Execute button did.
  cmd.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      execute();
    }
  });

  // Edit4Change (OnExit): the time quantum is checked when focus leaves the field.
  let quantumBusy = false;
  quantumField.addEventListener('blur', async () => {
    if (quantumBusy) return;
    const v = quantumField.value;
    const n = E.val(v);
    if (v !== '' && !Number.isNaN(n) && n >= 1) {
      sim.setQuantum(n);
      return;
    }
    // Leaving the page is not leaving the field; the complaint waits for a real exit.
    if (!document.hasFocus()) return;
    quantumBusy = true;
    // 1998: zero stopped the clock and a negative number became a 49-day quantum.
    await messageBox('Error', v === '' ? 'You havent selected the time interval' : 'That is not a proper time value', ['OK']);
    quantumField.focus();
    quantumBusy = false;
  });
  quantumField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cmd.focus();
  });

  function execute() {
    if (executeBtn.disabled || modal) return;
    sim.execute(cmd.value);
    // Execute gave the command line the focus back, and AutoSelect selected the text in it.
    cmd.focus();
    cmd.select();
  }

  function freeze() {
    if (!sim.frozen) {
      sim.freeze();
      freezeBtn.textContent = 'Continue';
      main.bar.freeze.caption = 'Continue';
    } else {
      sim.resume();
      freezeBtn.textContent = 'Freeze';
      main.bar.freeze.caption = 'Freeze';
    }
    executeBtn.disabled = resetBtn.disabled = sim.frozen;
    main.bar.execute.disabled = main.bar.reset.disabled = sim.frozen;
  }

  // Tmain.FormActivate, which was also the Reset button and the Reset menu item.
  function reset() {
    if (resetBtn.disabled) return;
    sim.reset();
    cmd.value = '';
    quantumField.value = String(sim.interval);
    cmd.focus();
  }

  function showMain(name, algo) {
    main.show();
    sim.login(name, algo);
    cmd.value = '';
    quantumField.value = String(sim.interval);
    cmd.focus();
  }

  // ------------------------------------------------------------------------- the editor

  let editName = 'untitled.bch';     // SaveDialog1.FileName: where Execute saves to
  const editor = makeWindow({
    title: 'Batch Editor',
    w: 578,
    h: 344,
    menu: [
      {
        caption: '&File',
        items: [
          { caption: '&New', shortcut: 'F1', run: clearEditor },
          { caption: '&Open', run: openFile },
          { caption: 'S&ave As..', run: saveAs },
          { caption: '&Save', shortcut: 'F2', run: () => save(editName) },
          { caption: 'E&xit', run: shutDown }
        ]
      },
      {
        caption: '&Help',
        items: [
          { caption: 'Contents', run: () => help('contents') },
          { caption: 'Comma&nds', run: () => help('commands') },
          { caption: 'A&bout', run: about }
        ]
      }
    ]
  });
  const ED = editor.client;
  const batchText = place(el('textarea', '', ED), 8, 8, 449, 329);
  batchText.maxLength = 255;
  batchText.spellcheck = false;
  batchText.style.font = '15px var(--term)';
  batchText.style.overflowX = 'scroll';
  button(ED, 'E&xecute as one', 464, 16, 105, 25, () => runFromEditor(''));
  button(ED, 'Execute Seperately', 464, 56, 105, 25, () => runFromEditor(' /s'));
  button(ED, '&Open', 464, 96, 105, 25, openFile);
  button(ED, 'S&ave As...', 464, 136, 105, 25, saveAs);
  button(ED, '&Clear', 464, 176, 105, 25, clearEditor);
  button(ED, '&Help', 464, 216, 105, 25, () => help('contents'));
  button(ED, '&Back', 464, 256, 105, 25, () => editor.hide());
  button(ED, '&Exit', 464, 296, 105, 25, shutDown);

  editor.node.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      clearEditor();
    } else if (e.key === 'F2') {
      e.preventDefault();
      save(editName);
    }
  });

  function openEditor(name, text) {
    editName = name;
    batchText.value = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
    editor.show();
    batchText.focus();
  }

  function clearEditor() {
    batchText.value = '';
    batchText.focus();
  }

  // TMemo.Lines.SaveToFile: every line ends in CR LF, an empty memo is an empty file.
  function save(name) {
    const v = batchText.value.replace(/\n$/, '');
    files.write(name, v === '' ? '' : v.split('\n').join('\r\n') + '\r\n');
  }

  // Execute as one / Execute Seperately: save, have the name stored on the simulated disk
  // (a 100-quantum std, queued only if it is not there yet), put the command on the command
  // line and go back. The user still presses Execute; pressed too soon, it is not on the disk.
  function runFromEditor(suffix) {
    save(editName);
    sim.storeBatch(editName);
    cmd.value = editName + suffix;
    editor.hide();
    executeBtn.focus();
  }

  async function openFile() {
    const name = await fileDialog('Open', '');
    if (name === null) return;
    const text = files.read(name);
    if (text === null) return messageBox('Open', name + '\nFile not found.\nPlease verify the correct file name was given.', ['OK']);
    batchText.value = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
  }

  async function saveAs() {
    const name = await fileDialog('Save As', editName);
    if (name === null) return;
    editName = name;
    save(name);
  }

  // A small common dialog over the real directory, filtered to Batch Files(*.bch).
  function fileDialog(title, initial) {
    return new Promise((resolve) => {
      modal++;
      const veil = el('div', 'modal-veil', desk);
      veil.style.zIndex = 999 + modal;
      const d = makeWindow({ title, w: 330, h: 196, cls: 'filedlg' });
      d.node.style.zIndex = 1000 + modal;
      d.node.classList.add('msgbox');
      const C = d.client;
      label(C, 'Look in:   OSS', 10, 10);
      const list = place(el('div', 'list', C), 10, 30, 230, 100);
      label(C, 'File name:', 10, 141);
      const nameField = input(C, 80, 138, 160, 21, { value: initial });
      label(C, 'Files of type:', 10, 168);
      const type = input(C, 80, 165, 160, 21, { readOnly: true, value: 'Batch Files(*.bch)' });
      type.tabIndex = -1;
      const ok = button(C, title === 'Open' ? '&Open' : '&Save', 250, 137, 70, 23);
      const cancel = button(C, 'Cancel', 250, 164, 70, 23);
      for (const f of files.list().filter((n) => /\.bch$/i.test(n))) {
        const row = el('div', '', list);
        row.textContent = f;
        row.addEventListener('click', () => {
          for (const r of list.children) r.classList.remove('sel');
          row.classList.add('sel');
          nameField.value = f;
        });
        row.addEventListener('dblclick', () => finish(f));
      }
      const finish = (v) => {
        d.node.remove();
        veil.remove();
        modal--;
        resolve(v);
      };
      const accept = () => {
        // Windows did not care about case and the simulated disk does, so names are kept in
        // lower case, as `edit` (which lowercases its whole command line) already had them.
        let n = nameField.value.trim().toLowerCase();
        if (!n) return;
        if (!/\.[^.\\/]*$/.test(n)) n += '.bch'; // DefaultExt = 'bch'
        finish(n);
      };
      ok.addEventListener('click', accept);
      cancel.addEventListener('click', () => finish(null));
      nameField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') accept();
        if (e.key === 'Escape') finish(null);
      });
      d.show();
      nameField.focus();
      nameField.select();
    });
  }

  // -------------------------------------------------------------------------- about box

  const aboutBox = makeWindow({ title: 'About...', w: 334, h: 215, cls: 'about' });
  const A = aboutBox.client;
  bevel(A, 35, 7, 262, 162);
  label(A, 'OS Simulator ver.1.2', 46, 9).style.fontSize = '24px';
  label(A, 'Program created by:', 68, 50).style.fontSize = '19px';
  const sig = label(A, 'Renegade and EmP', 38, 91, 'script');
  sig.style.fontSize = '29px';
  sig.style.width = '251px';
  sig.style.textAlign = 'center';
  label(A, 'January 1998', 95, 142).style.fontSize = '19px';
  button(A, 'OK', 129, 182, 75, 25, () => aboutBox.hide());
  function about() {
    aboutBox.show();
  }

  // ------------------------------------------------------------------------------- help

  const helpWin = makeWindow({ title: 'OSS Help', w: 470, h: 380, x: 150, y: 40, cls: 'help', onClose: () => helpWin.hide() });
  const helpBar = el('div', 'bar', helpWin.client);
  const page = el('div', 'helptext', helpWin.client);
  let topic = 'contents';
  const history = [];
  for (const [cap, run] of [
    ['&Contents', () => go('contents')],
    ['&Back', () => history.length && go(history.pop(), true)],
    ['<<', () => go(HELP.SEQUENCE[Math.max(0, HELP.SEQUENCE.indexOf(topic) - 1)])],
    ['>>', () => go(HELP.SEQUENCE[Math.min(HELP.SEQUENCE.length - 1, HELP.SEQUENCE.indexOf(topic) + 1)])]
  ]) {
    const b = el('button', '', helpBar);
    b.type = 'button';
    accel(b, cap);
    b.addEventListener('click', run);
  }
  page.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-topic]');
    if (a) go(a.dataset.topic);
  });
  function go(key, back) {
    if (!back && key !== topic) history.push(topic);
    topic = key;
    page.innerHTML = HELP.TOPICS[key].html;
    page.scrollTop = 0;
  }
  function help(key) {
    go(key);
    helpWin.show();
  }

  // ------------------------------------------------------------------- exit to windows

  const off = el('div', 'shutdown', desk);
  off.hidden = true;
  off.innerHTML = "<div>It's now safe to turn off<br>your computer.</div><small>Click to start OSS again</small>";
  off.addEventListener('click', () => {
    off.hidden = true;
    showLogin();
  });
  function shutDown() {
    sim.setTimer(false);
    for (const w of desk.querySelectorAll('.win')) w.hidden = true;
    off.hidden = false;
  }

  // ---------------------------------------------------------------- the simulator's view

  let tick = null;
  let ticking = false;
  function schedule() {
    clearTimeout(tick);
    tick = setTimeout(async () => {
      tick = null;
      ticking = true;
      try {
        await sim.tick();
      } finally {
        ticking = false;
      }
      if (sim.timer && !tick) schedule();
    }, sim.interval);
  }

  const view = {
    clear() {
      screen.clear();
      printerList.clear();
    },
    screen: (line) => screen.add(line),
    printer: (line) => printerList.add(line),
    memoryLine: (n, text) => memoryList.set(n, text),
    diskLine: (n, text) => diskList.set(n, text),
    active: (n) => (activeField.value = String(n)),
    current: (c) => (currentField.value = c),
    remaining: (n) => (remainingField.value = String(n)),
    timer(on) {
      if (!on) {
        clearTimeout(tick);
        tick = null;
      } else if (!ticking) schedule();
    },
    confirm: async (caption, text) => (await messageBox(caption, text, ['Yes', 'No'])) === 'Yes',
    alert: (caption, text) => void messageBox(caption, text, ['OK']),
    edit: openEditor,
    logout() {
      editor.hide();
      main.hide();
      showLogin();
    }
  };

  const sim = new E.Simulator(view, files);

  // Ctrl+X was File > Exit; in a text field it is Cut, which is what it does here.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'x' || e.key === 'X') && main.visible && !modal && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      shutDown();
    }
    if (e.key === 'Escape') closeMenus();
  });

  fit();
  showLogin();

  window.OSS = { sim, files, execute: (c) => { cmd.value = c; execute(); }, help, about, shutDown, fit };
})();
