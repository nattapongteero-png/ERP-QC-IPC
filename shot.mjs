/**
 * Screenshot + smoke-check a UAT page in Chromium — the engine Chrome uses.
 *
 * A picture only proves the page LOOKS right. Most of what the user actually
 * reports — "คลิกแล้วไม่แสดงใน Chrome", "กดไม่ได้" — is a runtime failure a
 * screenshot cannot show, and one that Firefox often does not reproduce. So
 * this also listens for console errors, uncaught exceptions and failed API
 * calls while the page runs.
 *
 * Git Bash rewrites a leading '/' into a Windows path, so prefix the command:
 *   MSYS_NO_PATHCONV=1 node shot.mjs "/accounting/ar/invoices" out.png 1920
 *
 * Widths to check: 1920 desktop · 1440 laptop · 768 tablet · 390 phone.
 */
import { chromium } from '@playwright/test';

const BASE = 'https://herbal-erp-test-uat.bmscloud.in.th';
const [, , path = '/accounting/ar/invoices', out = 'shot.png', width = '1920', lang = 'th'] =
  process.argv;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(width), height: 1000 },
  locale: lang === 'en' ? 'en-US' : 'th-TH',
});

// The app reads its language from the `locale` cookie (LOCALE_COOKIE_NAME).
// Setting it here lets the same page be captured in EN — English strings run
// longer than Thai, so a button that fits in one can overflow in the other.
await ctx.addCookies([
  { name: 'locale', value: lang, domain: 'herbal-erp-test-uat.bmscloud.in.th', path: '/' },
]);

const page = await ctx.newPage();

// Anything collected here means the page is broken at runtime even if it
// photographs perfectly.
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`CONSOLE: ${m.text().slice(0, 200)}`);
});
page.on('pageerror', (e) => problems.push(`JS ERROR: ${e.message.slice(0, 200)}`));
page.on('requestfailed', (r) => {
  if (r.url().startsWith(BASE)) {
    problems.push(`REQUEST FAILED: ${r.url().replace(BASE, '')} — ${r.failure()?.errorText}`);
  }
});
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    problems.push(`API ${r.status()}: ${r.url().replace(BASE, '')}`);
  }
});

// Log in via the API so we skip the login form entirely.
const res = await page.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'admin@herbal-erp.com', password: 'admin123' },
});
console.log('login:', res.status());

await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
// Let DevExtreme finish laying the grid out.
await page.waitForTimeout(3000);

await page.screenshot({ path: out, fullPage: true });
console.log("saved:", out, `(${width}px, ${lang})`);

if (problems.length) {
  console.log(`\n⚠️  ${problems.length} runtime problem(s) — a screenshot would NOT show these:`);
  for (const p of [...new Set(problems)].slice(0, 10)) console.log('  •', p);
} else {
  console.log('no console / JS / API errors');
}

await browser.close();
