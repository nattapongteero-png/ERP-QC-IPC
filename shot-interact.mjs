/**
 * Click-test the calibration points editor on the equipment form.
 *
 * A screenshot only proves the section LOOKS right. This drives it the way a
 * user would — press "เพิ่มจุดสอบเทียบ", type readings off a certificate — and
 * checks the derived error / max-error / verdict that the form computes. Runs
 * on chrome-headless-shell over raw CDP for the same reason as shot-cdp.mjs
 * (no node on this machine; Playwright cannot drive a browser under Bun).
 *
 *   bun shot-interact.mjs out.png 1920 th
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://herbal-erp-test-uat.bmscloud.in.th';
const HOST = 'herbal-erp-test-uat.bmscloud.in.th';
const [, , out = 'shot-interact.png', width = '1920', lang = 'th'] = process.argv;

const SHELL = join(
  process.env.LOCALAPPDATA,
  'ms-playwright',
  'chromium_headless_shell-1200',
  'chrome-headless-shell-win64',
  'chrome-headless-shell.exe',
);
const PORT = 9401;
const profile = mkdtempSync(join(tmpdir(), 'cdp-act-'));
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
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
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

  await cdp.send('Page.navigate', { url: `${BASE}/master-data/production-equipment/25` });
  await sleep(9000);

  // React controlled inputs ignore a plain `.value = x`; the native setter plus a
  // bubbling 'input' event is what React's onChange actually listens for.
  const REACT_SET = `
    function setVal(el, v) {
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `;

  // 1. Press "add calibration point" three times.
  const added = await cdp.eval(`(() => {
    const btn = document.querySelector('[data-testid="calib-add-point"]');
    if (!btn) return 'NO ADD BUTTON';
    btn.click(); btn.click(); btn.click();
    return 'clicked';
  })()`);
  await sleep(700);

  // 2. Type readings off a certificate: 200/199.8, 500/499.5, 1000/1000.3.
  const typed = await cdp.eval(`(() => {
    ${REACT_SET}
    const rows = [[200, 199.8], [500, 499.5], [1000, 1000.3]];
    let done = 0;
    rows.forEach(([nom, ind], i) => {
      const n = document.querySelector('[data-testid="calib-nominal-' + i + '"]');
      const d = document.querySelector('[data-testid="calib-indicated-' + i + '"]');
      if (n && d) { setVal(n, nom); setVal(d, ind); done++; }
    });
    return done + ' rows filled';
  })()`);
  await sleep(900);

  // 3. Tick the pre-use inspection checkbox (DevExtreme CheckBox).
  const ticked = await cdp.eval(`(() => {
    const box = document.querySelector('[data-testid="require-pre-use-inspection"]');
    if (!box) return 'NO CHECKBOX';
    box.click();
    return 'clicked';
  })()`);
  await sleep(600);

  // 4. Read back what the form computed.
  const summary = await cdp.eval(`(() => {
    const rows = [...document.querySelectorAll('[data-testid^="calib-nominal-"]')].length;
    const body = document.body.innerText;
    const grab = (re) => (body.match(re) || [])[0] || null;
    return {
      rows,
      maxError: grab(/ค่าคลาดเคลื่อนสูงสุด:[^\\n]*/),
      tolerance: grab(/เกณฑ์ยอมรับของเครื่อง:[^\\n]*/),
      verdict: /อยู่ในเกณฑ์/.test(body) ? 'within' : (/เกินเกณฑ์/.test(body) ? 'out' : 'none'),
      preUseChecked: document.querySelector('[data-testid="require-pre-use-inspection"]')
        ?.classList.contains('dx-checkbox-checked') ?? null,
    };
  })()`);

  console.log('add:', added, '| type:', typed, '| tick:', ticked);
  console.log('form computed:', JSON.stringify(summary, null, 2));

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('saved:', out);

  const unique = [...new Set(problems)];
  if (unique.length) {
    console.log(`\n!! ${unique.length} runtime problem(s):`);
    for (const p of unique.slice(0, 10)) console.log('  -', p);
  } else {
    console.log('no console / JS errors while interacting');
  }
} catch (err) {
  console.error('FAILED:', err.message);
  exitCode = 1;
} finally {
  proc.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(exitCode);
}
