/**
 * Screenshot a page with the browser emulating OS dark mode.
 *
 * Tailwind v4 keys `dark:` off prefers-color-scheme by default, so a bug that
 * only appears for dark-mode users is invisible to a normal screenshot. This
 * forces the media feature on so that class of defect is reproducible.
 *
 *   bun shot-dark.mjs "/dashboard" out.png 1920 th
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://herbal-erp-test-uat.bmscloud.in.th';
const HOST = 'herbal-erp-test-uat.bmscloud.in.th';
const [, , path = '/dashboard', out = 'shot-dark.png', width = '1920', lang = 'th'] = process.argv;

const SHELL = join(
  process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1200',
  'chrome-headless-shell-win64', 'chrome-headless-shell.exe',
);
const PORT = 9431;
const profile = mkdtempSync(join(tmpdir(), 'cdp-dark-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id != null && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method) for (const fn of this.listeners) fn(m);
    });
  }
  on(fn) { this.listeners.push(fn); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`${method} timed out`)); }
      }, 60000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? 'eval threw');
    return r.result.value;
  }
}

const proc = spawn(SHELL, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--headless',
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--disable-dev-shm-usage',
], { stdio: 'ignore' });

let exitCode = 0;
try {
  let target = null;
  for (let i = 0; i < 120 && !target; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) target = await r.json();
    } catch { /* not up */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('CDP never came up');

  const ws = await new Promise((res, rej) => {
    const s = new WebSocket(target.webSocketDebuggerUrl);
    s.addEventListener('open', () => res(s));
    s.addEventListener('error', () => rej(new Error('ws failed')));
  });
  const cdp = new Cdp(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Number(width), height: 1200, deviceScaleFactor: 1, mobile: false,
  });
  // The whole point: pretend the OS is in dark mode.
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@herbal-erp.com', password: 'admin123' }),
  });
  const token = /auth-token=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')?.[1];
  if (!token) throw new Error('no auth token');
  await cdp.send('Network.setCookies', {
    cookies: [
      { name: 'auth-token', value: token, domain: HOST, path: '/' },
      { name: 'locale', value: lang, domain: HOST, path: '/' },
    ],
  });

  await cdp.send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(9000);

  // Report any element whose computed background is near-black — that is the
  // shape of the reported defect, and it is checkable without eyeballing.
  const dark = await cdp.eval(`(() => {
    const isDark = (c) => {
      const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c || '');
      if (!m) return false;
      const [r,g,b] = [ +m[1], +m[2], +m[3] ];
      return (0.2126*r + 0.7152*g + 0.0722*b) < 60;
    };
    const hits = [];
    for (const el of document.querySelectorAll('span,div')) {
      const bg = getComputedStyle(el).backgroundColor;
      if (isDark(bg) && el.getBoundingClientRect().width < 120 && el.getBoundingClientRect().width > 10) {
        hits.push({ cls: (el.className || '').toString().slice(0, 80), bg });
      }
    }
    return { count: hits.length, sample: hits.slice(0, 5) };
  })()`);

  console.log('prefers-color-scheme: dark');
  console.log('near-black small boxes found:', JSON.stringify(dark, null, 2));

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('saved:', out);
} catch (err) {
  console.error('FAILED:', err.message);
  exitCode = 1;
} finally {
  proc.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(exitCode);
}
