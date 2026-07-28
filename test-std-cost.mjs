/**
 * E2E check for the two reported standard-costs bugs:
 *   1. popup overflowed the viewport so Save could not be reached/clicked
 *   2. POST /api/accounting/standard-costs died with
 *      "a.toISOString is not a function"
 *
 * A screenshot alone cannot prove either. This drives the real UI in Chromium
 * (the engine Chrome uses), clicks Save for real, and reports what the API
 * actually returned.
 */
import { chromium } from '@playwright/test';

const BASE = 'https://herbal-erp-test-uat.bmscloud.in.th';

// Width/lang are arguments so the same real-click proof runs at every size the
// project requires (1920 desktop, 1440 laptop, 768 tablet, 390 phone) in both
// languages. A short viewport is the case that broke: the popup grows with the
// form, so Save leaves the screen soonest on the smallest height.
//   node test-std-cost.mjs 390 en
const width = Number(process.argv[2] || 1920);
const lang = process.argv[3] || 'th';
// Heights matched to real devices rather than a constant, so 390 is genuinely
// phone-shaped and not a tall narrow window no user actually has.
const height = width >= 1920 ? 1000 : width >= 1440 ? 900 : width >= 768 ? 1024 : 844;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height },
  locale: lang === 'en' ? 'en-US' : 'th-TH',
});
await ctx.addCookies([
  { name: 'locale', value: lang, domain: 'herbal-erp-test-uat.bmscloud.in.th', path: '/' },
]);
const page = await ctx.newPage();
console.log(`\n=== ${width}x${height} · ${lang.toUpperCase()} ===`);

const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => problems.push(`JS ERROR: ${e.message.slice(0, 200)}`));

// Capture exactly what the POST under test returns.
let postResult = null;
page.on('response', async (r) => {
  if (r.url().includes('/api/accounting/standard-costs') && r.request().method() === 'POST') {
    let body = '';
    try { body = (await r.text()).slice(0, 400); } catch { /* body already consumed */ }
    postResult = { status: r.status(), body };
  }
});

await page.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'admin@herbal-erp.com', password: 'admin123' },
});

await page.goto(`${BASE}/accounting/standard-costs`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Open the create dialog via its toolbar button.
const addBtn = page.locator('.dx-button').filter({ hasText: /เพิ่ม|Add|New/ }).first();
await addBtn.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `std-${width}-${lang}-1-open.png`, fullPage: false });

// BUG 1: is Save inside the viewport and actually clickable?
// Scope to the whole popup, not .dx-popup-content: the fix deliberately moves
// Save into the popup's bottom TOOLBAR, which is a sibling of the content box.
// Target .dx-button itself — a .filter({hasText}) on a broader selector can
// resolve to an ancestor whose box is overlapped, which reads as "intercepted"
// even though the button is perfectly clickable.
const save = page.locator('.dx-popup-wrapper .dx-toolbar .dx-button')
  .filter({ hasText: /บันทึก|Save/ }).first();
const cnt = await save.count();
console.log('save button found:', cnt);
if (cnt) {
  const box = await save.boundingBox();
  const vh = page.viewportSize().height;
  console.log('save box:', JSON.stringify(box), 'viewportH:', vh);
  console.log('save within viewport:', box && box.y >= 0 && box.y + box.height <= vh ? 'YES' : 'NO — off-screen');
}

// Pick the first item in the item selector so the form is valid.
const sel = page.locator('.dx-popup-content .dx-selectbox').first();
if (await sel.count()) {
  await sel.click();
  await page.waitForTimeout(1500);
  // Must be scoped to the dropdown's own overlay. A bare '.dx-item-content'
  // also matches .dx-toolbar-item-content inside the popup, so the click landed
  // on a toolbar element hidden behind the shader and looked like the app was
  // blocking it.
  const opt = page.locator('.dx-popup-wrapper .dx-list-item, .dx-overlay-content .dx-list-item').first();
  if (await opt.count()) {
    console.log('picking item:', (await opt.innerText()).slice(0, 60).replace(/\n/g, ' '));
    await opt.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('NO ITEMS in dropdown — cannot select');
  }
}
await page.screenshot({ path: `std-${width}-${lang}-2-filled.png`, fullPage: false });

// BUG 2: click Save for real and see what the API says.
if (cnt) {
  try {
    await save.click({ timeout: 10000 });
    console.log('save CLICKED ok');
  } catch (e) {
    console.log('save NOT CLICKABLE:', String(e).split('\n')[0].slice(0, 160));
  }
  await page.waitForTimeout(4000);
}
await page.screenshot({ path: `std-${width}-${lang}-3-after-save.png`, fullPage: false });

console.log('\nPOST result:', postResult ? `${postResult.status} ${postResult.body}` : 'no POST fired');
console.log(problems.length ? `\nruntime problems:\n  ${[...new Set(problems)].slice(0, 8).join('\n  ')}` : '\nno console/JS errors');

await browser.close();
