/**
 * Playwright E2E test for lot save DOM error
 * Tests that saving a lot doesn't cause "removeChild" DOM error
 *
 * Run with: npx playwright test tests/e2e/lot-save-error.spec.ts --headed
 */
import { test, expect, Page } from '@playwright/test';

// Test credentials
const TEST_USER = {
  email: 'admin@herbal-erp.com',
  password: 'admin123'
};

const BASE_URL = 'http://localhost:33021';

// Helper function to login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill login form
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  console.log('Login successful');
}

test.describe('Lot Save DOM Error Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('should save lot without removeChild DOM error', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to lots page
    console.log('Navigating to lots page...');
    await page.goto(`${BASE_URL}/inventory/lots`);

    // Wait for page to load
    await page.waitForSelector('button:has-text("รับ Lot ใหม่")', { timeout: 30000 });
    console.log('Page loaded');
    await page.waitForTimeout(1000);

    // Click "รับ Lot ใหม่" button to open dialog
    console.log('Opening dialog...');
    await page.click('button:has-text("รับ Lot ใหม่")');
    await page.waitForTimeout(500);

    // Wait for dialog to open
    await page.waitForSelector('text=รับสินค้าเข้าคลัง', { timeout: 5000 });
    console.log('Dialog opened');

    // Generate lot number
    console.log('Generating lot number...');
    await page.click('button:has-text("สร้าง")');
    await page.waitForTimeout(300);

    // Click item selector button
    console.log('Selecting item...');
    await page.click('button:has-text("คลิกเพื่อเลือกสินค้า")');
    await page.waitForTimeout(1000);

    // Wait for item dialog
    await page.waitForSelector('text=เลือกสินค้าที่จะรับ', { timeout: 5000 });
    console.log('Item dialog opened');

    // Click first "Select" button in the item grid
    const selectButton = page.locator('td[role="gridcell"] button:has-text("Select")').first();
    await selectButton.click();
    await page.waitForTimeout(500);
    console.log('Item selected');

    // Select warehouse using DevExtreme dropdown
    console.log('Selecting warehouse...');
    // Click on warehouse dropdown container
    await page.locator('.dx-selectbox').first().click();
    await page.waitForTimeout(300);

    // Select first available warehouse option (skip the placeholder)
    await page.locator('[role="option"]').nth(1).click();
    await page.waitForTimeout(300);
    console.log('Warehouse selected');

    // Enter quantity using DevExtreme number box
    console.log('Entering quantity...');
    await page.locator('.dx-numberbox input[role="spinbutton"]').first().fill('100');
    await page.waitForTimeout(200);

    // Enter unit price
    console.log('Entering unit price...');
    await page.locator('input[placeholder="0.00"]').fill('50');
    await page.waitForTimeout(200);

    // Select expiry date
    console.log('Selecting expiry date...');
    // Find the expiry date field (วันหมดอายุ) and click it
    const expiryContainer = page.locator('text=วันหมดอายุ *').locator('..').locator('.dx-dropdowneditor-input-wrapper');
    await expiryContainer.click();
    await page.waitForTimeout(500);

    // Click next month button to select a future date
    await page.click('button[aria-label="Next month"]');
    await page.waitForTimeout(300);

    // Select day 15
    await page.locator('[role="gridcell"]:has-text("15")').first().click();
    await page.waitForTimeout(300);
    console.log('Expiry date selected');

    // Clear errors before submit to only capture submit-related errors
    const errorsBeforeSubmit = [...errors];
    errors.length = 0;

    // Submit the form
    console.log('Submitting form...');
    await page.click('button:has-text("รับ Lot"):not(:has-text("ใหม่"))');

    // Wait for the result
    await page.waitForTimeout(3000);

    // Check for removeChild error
    const hasRemoveChildError = errors.some(e =>
      e.includes('removeChild') ||
      e.includes('NotFoundError')
    );

    // Log all errors for debugging
    console.log('\n=== ERRORS AFTER SUBMIT ===');
    if (errors.length > 0) {
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    } else {
      console.log('  No errors captured after submit!');
    }
    console.log('===========================\n');

    // Assert no removeChild error occurred
    expect(hasRemoveChildError, `Expected no removeChild error but found: ${errors.filter(e => e.includes('removeChild') || e.includes('NotFoundError')).join(', ')}`).toBe(false);

    // Verify dialog is closed (lot was saved successfully)
    await page.waitForTimeout(500);
    const dialogVisible = await page.locator('text=รับสินค้าเข้าคลัง').isVisible().catch(() => false);

    if (dialogVisible) {
      console.log('WARNING: Dialog still visible after save');
    } else {
      console.log('SUCCESS: Dialog closed after save');
    }
  });
});
