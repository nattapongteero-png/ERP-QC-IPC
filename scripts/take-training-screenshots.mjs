import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:33021';
const OUT = 'public/training/screenshots';
mkdirSync(OUT, { recursive: true });

const pages = [
  { url: '/inventory/items', name: '01-items-list' },
  { url: '/production/bom', name: '03-bom-list' },
  { url: '/purchasing/orders', name: '04-po-list' },
  { url: '/purchasing/orders/new', name: '05-po-new' },
  { url: '/production/work-orders', name: '06-wo-list' },
  { url: '/inventory/lots', name: '07-lots-list' },
  { url: '/quality/tests', name: '08-qc-tests' },
  { url: '/sales/orders', name: '09-sales-orders' },
];

async function login(context) {
  const page = await context.newPage();
  console.log('Logging in...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Fill login form
  await page.fill('input[type="email"], input[name="email"]', 'admin@herbal-erp.com');
  await page.fill('input[type="password"], input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // Wait for redirect after login
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {
    console.log('  Did not redirect to dashboard, checking current URL...');
  });
  await page.waitForTimeout(3000);
  console.log(`  Logged in. Current URL: ${page.url()}`);
  await page.close();
}

async function capture(context, url, name) {
  const page = await context.newPage();
  try {
    console.log(`Capturing: ${name} (${url})`);
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    // Check we're not on login page
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.error(`  !! Redirected to login for ${name}`);
      await page.close();
      return false;
    }
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`  -> Saved ${name}.png`);
    await page.close();
    return true;
  } catch (e) {
    console.error(`  !! Failed ${name}: ${e.message}`);
    await page.close();
    return false;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'th-TH',
  });

  // Step 1: Login
  await login(context);

  // Step 2: Warm up
  console.log('\n=== Warming up pages ===');
  for (const p of pages) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500);
    } catch { /* ignore */ }
    await page.close();
  }
  console.log('  Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));

  // Step 3: Capture screenshots
  console.log('\n=== Capturing screenshots ===');
  for (const p of pages) {
    await capture(context, p.url, p.name);
  }

  // Step 4: Detail pages
  console.log('\n=== Detail pages ===');

  // WO detail
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/production/work-orders`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const link = await page.$('a[href*="/production/work-orders/"]');
    if (link) {
      const href = await link.getAttribute('href');
      await page.close();
      // warm up
      const wp = await context.newPage();
      await wp.goto(`${BASE}${href}`, { waitUntil: 'load', timeout: 30000 });
      await wp.waitForTimeout(2000);
      await wp.close();
      await new Promise(r => setTimeout(r, 3000));
      await capture(context, href, '10-wo-detail');
    } else {
      console.log('  No WO link found');
      await page.close();
    }
  }

  // BOM detail
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/production/bom`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const link = await page.$('a[href*="/production/bom/"]');
    if (link) {
      const href = await link.getAttribute('href');
      await page.close();
      const wp = await context.newPage();
      await wp.goto(`${BASE}${href}`, { waitUntil: 'load', timeout: 30000 });
      await wp.waitForTimeout(2000);
      await wp.close();
      await new Promise(r => setTimeout(r, 3000));
      await capture(context, href, '11-bom-detail');
    } else {
      console.log('  No BOM link found');
      await page.close();
    }
  }

  // PO detail
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/purchasing/orders`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const links = await page.$$('a[href*="/purchasing/orders/"]');
    let found = false;
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && !href.includes('/new')) {
        await page.close();
        const wp = await context.newPage();
        await wp.goto(`${BASE}${href}`, { waitUntil: 'load', timeout: 30000 });
        await wp.waitForTimeout(2000);
        await wp.close();
        await new Promise(r => setTimeout(r, 3000));
        await capture(context, href, '12-po-detail');
        found = true;
        break;
      }
    }
    if (!found) {
      console.log('  No PO link found');
      await page.close();
    }
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
