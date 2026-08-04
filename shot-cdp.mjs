/**
 * Screenshot + smoke-check a UAT page — Bun-only variant of shot.mjs.
 *
 * This machine has no `node`, only `bun`, and Playwright cannot drive a browser
 * under Bun on Windows: its --remote-debugging-pipe handshake never completes,
 * and connectOverCDP stalls on Bun's WebSocket client. So this talks raw CDP to
 * chrome-headless-shell over Bun's native WebSocket instead — same engine Chrome
 * uses, same checks (console errors, page errors, failing API calls).
 *
 *   bun shot-cdp.mjs "/master-data/ipc-criteria" out.png 1920 th
 *
 * Widths to check: 1920 desktop · 1440 laptop · 768 tablet · 390 phone.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://herbal-erp-test-uat.bmscloud.in.th';
const HOST = 'herbal-erp-test-uat.bmscloud.in.th';
const [, , path = '/', out = 'shot.png', width = '1920', lang = 'th'] = process.argv;

const SHELL =
  process.env.PW_CHROME ??
  join(
    process.env.LOCALAPPDATA,
    'ms-playwright',
    'chromium_headless_shell-1200',
    'chrome-headless-shell-win64',
    'chrome-headless-shell.exe',
  );

const PORT = 9333 + (Number(process.env.PW_PORT_OFFSET) || 0);
const profile = mkdtempSync(join(tmpdir(), 'cdp-shot-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- CDP client
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  on(fn) {
    this.listeners.push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP ${method} timed out`));
        }
      }, 60000);
    });
  }
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (e) => reject(new Error(`ws error: ${e?.message ?? 'unknown'}`)));
  });
}

// -------------------------------------------------------------------- launch
const proc = spawn(
  SHELL,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--disable-dev-shm-usage',
  ],
  { stdio: 'ignore' },
);

const problems = [];
let exitCode = 0;

try {
  // Wait for the debugging endpoint, then open a fresh tab to attach to.
  let target = null;
  for (let i = 0; i < 120 && !target; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) target = await r.json();
    } catch {
      /* not up yet */
    }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error(`CDP endpoint on :${PORT} never came up`);

  const cdp = new Cdp(await openWs(target.webSocketDebuggerUrl));

  // Collect the runtime failures a screenshot cannot show.
  cdp.on((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params?.exceptionDetails;
      problems.push(`JS ERROR: ${(d?.exception?.description ?? d?.text ?? '').slice(0, 200)}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      const text = (msg.params.args ?? [])
        .map((a) => a.value ?? a.description ?? '')
        .join(' ')
        .slice(0, 200);
      if (text.trim()) problems.push(`CONSOLE: ${text}`);
    } else if (msg.method === 'Network.loadingFailed') {
      problems.push(`REQUEST FAILED: ${msg.params?.errorText}`);
    } else if (msg.method === 'Network.responseReceived') {
      const { url, status } = msg.params?.response ?? {};
      if (url?.includes('/api/') && status >= 400) {
        problems.push(`API ${status}: ${url.replace(BASE, '')}`);
      }
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: 1000,
    deviceScaleFactor: 1,
    mobile: Number(width) < 500,
  });

  // Log in over HTTP, then hand the session cookie to the browser — same trick
  // as shot.mjs, so we never touch the login form.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@herbal-erp.com', password: 'admin123' }),
  });
  const setCookie = login.headers.get('set-cookie') ?? '';
  const token = /auth-token=([^;]+)/.exec(setCookie)?.[1];
  console.log('login:', login.status, token ? '(token captured)' : '(NO TOKEN)');
  if (!token) throw new Error('login did not return an auth-token cookie');

  await cdp.send('Network.setCookies', {
    cookies: [
      { name: 'auth-token', value: token, domain: HOST, path: '/' },
      // The app reads its language from this cookie — EN strings run longer
      // than Thai, so a control that fits in one can overflow in the other.
      { name: 'locale', value: lang, domain: HOST, path: '/' },
    ],
  });

  const loaded = new Promise((resolve) => {
    cdp.on((m) => {
      if (m.method === 'Page.loadEventFired') resolve();
    });
  });
  await cdp.send('Page.navigate', { url: `${BASE}${path}` });
  await Promise.race([loaded, sleep(60000)]);
  // Let DevExtreme finish laying the grid out and data fetches settle.
  await sleep(5000);

  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('saved:', out, `(${width}px, ${lang})`);

  const unique = [...new Set(problems)];
  if (unique.length) {
    console.log(`\n!! ${unique.length} runtime problem(s) — a screenshot would NOT show these:`);
    for (const p of unique.slice(0, 10)) console.log('  -', p);
  } else {
    console.log('no console / JS / API errors');
  }
} catch (err) {
  console.error('FAILED:', err.message);
  exitCode = 1;
} finally {
  proc.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(exitCode);
}
