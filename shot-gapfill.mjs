/**
 * Click-test the gap-fill path on a locked GRN line.
 *
 * Opens the GRN, presses the line's edit action and reports what the dialog
 * offers — the constraint banner, whether quantity is locked out, and which
 * fields are open. Does NOT save: the real mfg/expiry must come from the
 * supplier's COA, not from a test script.
 *
 *   bun shot-gapfill.mjs <grnId> out.png 1920 th
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://herbal-erp-test-uat.bmscloud.in.th';
const HOST = 'herbal-erp-test-uat.bmscloud.in.th';
const [, , grnId = '68', out = 'shot-gapfill.png', width = '1920', lang = 'th'] = process.argv;

const SHELL = join(
  process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1200',
  'chrome-headless-shell-win64', 'chrome-headless-shell.exe',
);
const PORT = 9421;
const profile = mkdtempSync(join(tmpdir(), 'cdp-gap-'));
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

const problems = [];
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

  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails;
      problems.push(`JS ERROR: ${(d?.exception?.description ?? d?.text ?? '').slice(0, 200)}`);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      const t = (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200);
      if (t.trim()) problems.push(`CONSOLE: ${t}`);
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Number(width), height: 1200, deviceScaleFactor: 1, mobile: false,
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

  await cdp.send('Page.navigate', { url: `${BASE}/inventory/goods-receipt/${grnId}` });
  await sleep(9000);

  // devextreme-react's <Button> does not forward data-testid to the DOM, so
  // find the action by its label instead.
  const opened = await cdp.eval(`(() => {
    const btns = [...document.querySelectorAll('.dx-button, button')];
    const btn = btns.find((b) => /เติมวันที่ที่ขาด|Fill missing dates/i.test(b.textContent || ''));
    if (!btn) return 'NO gap-fill button — labels seen: ' + btns.map((b) => (b.textContent||'').trim()).filter(Boolean).slice(0, 8).join(' | ');
    const label = (btn.textContent || '').trim();
    btn.click();
    return 'clicked, label = ' + label;
  })()`);
  await sleep(3500);

  const state = await cdp.eval(`(() => {
    const hint = document.querySelector('[data-testid="gap-fill-hint"]');
    const qty = document.querySelector('[data-testid="edit-actual-qty"]');
    const mfg = document.querySelector('[data-testid="edit-mfg-date"] input, [data-testid="edit-mfg-date"]');
    return {
      dialogOpen: !!document.querySelector('[data-testid="edit-line-popup"], .dx-popup-content'),
      gapFillBannerShown: !!hint,
      bannerText: hint ? hint.textContent.trim().slice(0, 120) : null,
      quantityDisabled: qty ? qty.disabled : null,
      mfgFieldPresent: !!mfg,
    };
  })()`);

  console.log('open:', opened);
  console.log('dialog:', JSON.stringify(state, null, 2));

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('saved:', out);

  const unique = [...new Set(problems)];
  if (unique.length) {
    console.log(`\n!! ${unique.length} runtime problem(s):`);
    for (const p of unique.slice(0, 8)) console.log('  -', p);
  } else {
    console.log('no console / JS errors');
  }
} catch (err) {
  console.error('FAILED:', err.message);
  exitCode = 1;
} finally {
  proc.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(exitCode);
}
