import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:33021';
const OUT = 'public/training/screenshots';
mkdirSync(OUT, { recursive: true });

const detailPages = [
  { url: '/production/work-orders/1', name: '10-wo-detail' },
  { url: '/production/bom/48', name: '11-bom-detail' },
  { url: '/purchasing/orders/20', name: '12-po-detail' },
  { url: '/purchasing/requisitions', name: '13-requisitions' },
  { url: '/inventory/items', name: '14-items-tab-raw', clickTab: 'วัตถุดิบ' },
  { url: '/quality/tests/new', name: '15-qc-new' },
  { url: '/dashboard', name: '16-dashboard' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'th-TH',
  });

  // Login
  const loginPage = await context.newPage();
  console.log('Logging in...');
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await loginPage.waitForTimeout(2000);
  await loginPage.fill('input[type="email"], input[name="email"]', 'admin@herbal-erp.com');
  await loginPage.fill('input[type="password"], input[name="password"]', 'admin123');
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForTimeout(5000);
  console.log(`  Logged in. URL: ${loginPage.url()}`);
  await loginPage.close();

  // Warm up all pages
  console.log('\nWarming up...');
  for (const p of detailPages) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500);
    } catch { /* ignore */ }
    await page.close();
  }
  await new Promise(r => setTimeout(r, 5000));

  // Capture
  console.log('\nCapturing...');
  for (const p of detailPages) {
    const page = await context.newPage();
    try {
      console.log(`  ${p.name} (${p.url})`);
      await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(4000);

      if (p.clickTab) {
        try {
          await page.click(`text="${p.clickTab}"`, { timeout: 5000 });
          await page.waitForTimeout(2000);
        } catch { console.log(`    Tab "${p.clickTab}" not found`); }
      }

      await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: false });
      console.log(`    -> Saved ${p.name}.png`);
    } catch (e) {
      console.error(`    !! Failed: ${e.message}`);
    }
    await page.close();
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
