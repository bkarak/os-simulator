#!/usr/bin/env node
// Drive the simulator in headless Chrome and save a PNG of the 640x480 desktop.
//
//   node tools/screenshot.mjs <url> <out.png> [script.js] [--scale 2]
//
// script.js is evaluated in the page as the body of an async function before the capture; it
// gets `sleep(ms)` and `type(selectorOrElement, text)` and can use window.OSS; whatever it leaves
// in window.__result is printed as JSON. Talks to Chrome
// over the DevTools protocol with Node's own WebSocket, so it needs nothing installed but Chrome.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const scale = Number(flag('--scale', '2'));
const [url, out, scriptFile] = args;
if (!url || !out) {
  console.error('usage: screenshot.mjs <url> <out.png> [script.js] [--scale 2]');
  process.exit(2);
}
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), 'oss-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=640,480', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 100 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  } catch {
    await sleep(100);
  }
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const waiters = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) {
    for (const w of waiters.splice(0)) w(msg);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) => (msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const event = (name) =>
  new Promise((resolve) => {
    const w = (msg) => (msg.method === name ? resolve(msg) : waiters.push(w));
    waiters.push(w);
  });

try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 480, deviceScaleFactor: scale, mobile: false });
  const loaded = event('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
  const body = scriptFile ? readFileSync(scriptFile, 'utf8') : '';
  const prelude = `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const type = (target, text) => { const n = typeof target === 'string' ? document.querySelector(target) : target;
      n.focus(); n.value = text; n.dispatchEvent(new Event('input', { bubbles: true })); };`;
  const res = await send('Runtime.evaluate', {
    expression: `(async () => { ${prelude}\n${body}\n; const __r = document.querySelector('.oss-desktop').getBoundingClientRect();
      return JSON.stringify({ x: __r.x, y: __r.y, width: __r.width, height: __r.height, result: window.__result }); })()`,
    awaitPromise: true,
    returnByValue: true
  });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  const { result, ...box } = JSON.parse(res.result.value);
  if (result !== undefined) console.log(JSON.stringify(result, null, 1));
  const clip = Object.assign(box, { scale: 1 });
  const shot = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(out, Math.round(clip.width * scale) + 'x' + Math.round(clip.height * scale));
} finally {
  ws.close();
  chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}
