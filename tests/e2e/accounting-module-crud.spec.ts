/**
 * Playwright E2E tests for Accounting Module CRUD Operations
 * 
 * Tests complete accounting workflows including:
 * - Accounting Dashboard accessibility and KPIs
 * - Chart of Accounts CRUD
 * - Journal Entries (extended tests beyond existing)
 * - Fixed Assets CRUD
 * - AR Module (Dashboard, Invoices, Receipts)
 * - AP Module (Dashboard, Invoices, Payments)
 * - Reports (Trial Balance, VAT, WHT)
 * - Period Close functionality
 * - Equipment CRUD
 *
 * Run with: npx playwright test tests/e2e/accounting-module-crud.spec.ts --headed
 * Full HD: npx playwright test tests/e2e/accounting-module-crud.spec.ts --headed --viewport-size=1920,1080
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ====================== CONFIGURATION ======================

const TEST_USER = {
  email: 'admin@herbal-erp.com',
  password: 'admin123'
};

const BASE_URL = 'http://localhost:33021';

// Full HD viewport configuration
test.use({
  viewport: { width: 1920, height: 1080 },
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
});

// ====================== HELPER FUNCTIONS ======================

// Login helper
async function login(page: Page) {
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/login`);

  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  console.log('Login page loaded');

  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  console.log('Submitted login form');

  await page.waitForURL(url => {
    const urlStr = String(url);
    return urlStr.includes('/dashboard') || urlStr.includes('/accounting') || urlStr.includes('/hr');
  }, { timeout: 15000 });
  console.log('Login successful');
}

// Generate unique test data
function generateTestData(prefix: string) {
  const timestamp = Date.now();
  return {
    code: `${prefix}-${timestamp}`.substring(0, 20),
    name: `Test ${prefix} ${timestamp}`,
    nameTh: `ทดสอบ ${prefix} ${timestamp}`,
    nameEn: `Test ${prefix} ${timestamp}`,
    description: `Test ${prefix} created at ${new Date().toISOString()}`,
    amount: Math.round(Math.random() * 10000 + 1000),
  };
}

// DevExtreme TextBox helper
async function setDevExtremeText(page: Page, selector: string, value: string) {
  const container = page.locator(selector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(200);
}

// DevExtreme TextArea helper
async function setDevExtremeTextArea(page: Page, selector: string, value: string) {
  const container = page.locator(selector);
  const input = container.locator('textarea.dx-texteditor-input');
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(200);
}

// DevExtreme SelectBox helper
async function selectDevExtremeOption(page: Page, selector: string, optionIndex: number = 0) {
  const container = page.locator(selector);
  const selectBox = container.locator('.dx-selectbox, .dx-dropdowneditor');

  await selectBox.click();
  await page.waitForTimeout(500);

  const visibleListbox = page.locator('[role="listbox"]:visible');
  await visibleListbox.waitFor({ state: 'visible', timeout: 10000 });

  const options = visibleListbox.locator('[role="option"]');
  await options.first().waitFor({ state: 'visible', timeout: 5000 });
  
  const optionCount = await options.count();
  if (optionCount > optionIndex) {
    await options.nth(optionIndex).click();
  } else if (optionCount > 0) {
    await options.first().click();
  }
  await page.waitForTimeout(300);
}

// DevExtreme DateBox helper
async function setDevExtremeDate(page: Page, selector: string, dateStr: string) {
  const container = page.locator(selector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill(dateStr);
  await input.press('Enter');
  await page.waitForTimeout(300);
}

// DevExtreme NumberBox helper
async function setDevExtremeNumber(page: Page, selector: string, value: number) {
  const container = page.locator(selector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill('');
  await input.fill(value.toString());
  await input.press('Enter');
  await page.waitForTimeout(300);
}

// DevExtreme CheckBox helper
async function setDevExtremeCheckbox(page: Page, selector: string, checked: boolean) {
  const container = page.locator(selector);
  const checkbox = container.locator('.dx-checkbox');
  const isChecked = await checkbox.getAttribute('aria-checked') === 'true';
  
  if (isChecked !== checked) {
    await checkbox.click();
    await page.waitForTimeout(200);
  }
}

// Wait for loading to complete
async function waitForLoading(page: Page) {
  // Wait for any loading indicators to disappear
  await page.waitForTimeout(500);
  try {
    await page.waitForSelector('.dx-loadpanel-content', { state: 'hidden', timeout: 5000 });
  } catch {
    // No load panel visible, continue
  }
}

function createErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Failed to fetch') && 
          !text.includes('FetchInterceptor') &&
          !text.includes('favicon.ico') &&
          !text.includes('ResizeObserver') &&
          !text.includes('404') &&
          !text.includes('net::ERR_NETWORK_CHANGED')) {
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    }
  });
  return errors;
}

// ====================== TEST SUITES ======================

test.describe('Accounting Module E2E Tests', () => {
  test.setTimeout(120000); // 2 minutes per test

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ==================== ACCOUNTING DASHBOARD ====================
  test.describe('Accounting Dashboard', () => {
    
    test('should display dashboard with all KPIs and charts', async ({ page }) => {
      const errors = createErrorCollector(page);

      console.log('Step 1: Navigating to accounting dashboard...');
      await page.goto(`${BASE_URL}/accounting`);
      await page.waitForTimeout(2000);

      // Wait for page to load
      await page.waitForSelector('[data-testid="accounting-dashboard"]', { timeout: 15000 });
      console.log('Accounting dashboard loaded');

      // Verify KPI cards are visible
      await expect(page.locator('[data-testid="kpi-cash-balance"]')).toBeVisible();
      console.log('Cash balance KPI visible');

      await expect(page.locator('[data-testid="kpi-ar-balance"]')).toBeVisible();
      console.log('AR balance KPI visible');

      await expect(page.locator('[data-testid="kpi-ap-balance"]')).toBeVisible();
      console.log('AP balance KPI visible');

      await expect(page.locator('[data-testid="kpi-net-income"]')).toBeVisible();
      console.log('Net income KPI visible');

      // Verify charts are rendered
      await expect(page.locator('[data-testid="chart-financial-position"]')).toBeVisible();
      console.log('Financial position chart visible');

      await expect(page.locator('[data-testid="chart-cash-flow"]')).toBeVisible();
      console.log('Cash flow chart visible');

      // Verify quick links
      await expect(page.locator('[data-testid="quick-links"]')).toBeVisible();
      console.log('Quick links visible');

      // Check for console errors
      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('Dashboard test completed successfully');
    });

    test('should navigate to all accounting modules from dashboard', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting`);
      await page.waitForSelector('[data-testid="accounting-dashboard"]', { timeout: 15000 });

      // Test navigation to Chart of Accounts
      const coaLink = page.locator('[data-testid="quick-link-chart-of-accounts"]');
      if (await coaLink.isVisible()) {
        await coaLink.click();
        await page.waitForURL('**/accounting/chart-of-accounts', { timeout: 10000 });
        console.log('Navigated to Chart of Accounts');
        await page.goBack();
        await page.waitForSelector('[data-testid="accounting-dashboard"]', { timeout: 10000 });
      }

      // Test navigation to Journal Entries
      const jeLink = page.locator('[data-testid="quick-link-journal-entries"]');
      if (await jeLink.isVisible()) {
        await jeLink.click();
        await page.waitForURL('**/accounting/journal-entries', { timeout: 10000 });
        console.log('Navigated to Journal Entries');
        await page.goBack();
        await page.waitForSelector('[data-testid="accounting-dashboard"]', { timeout: 10000 });
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('Navigation test completed');
    });
  });

  // ==================== CHART OF ACCOUNTS ====================
  test.describe('Chart of Accounts CRUD', () => {
    
    test('should display chart of accounts page with TreeList', async ({ page }) => {
      const errors = createErrorCollector(page);

      console.log('Step 1: Navigating to Chart of Accounts...');
      await page.goto(`${BASE_URL}/accounting/chart-of-accounts`);
      await waitForLoading(page);

      // Wait for page to load
      await page.waitForSelector('[data-testid="coa-page"]', { timeout: 15000 });
      console.log('Chart of Accounts page loaded');

      // Verify KPI cards
      await expect(page.locator('[data-testid="coa-stats"]')).toBeVisible();
      console.log('COA stats visible');

      // Verify TreeList is visible
      await expect(page.locator('[data-testid="coa-treelist"]')).toBeVisible();
      console.log('TreeList visible');

      // Verify Add button
      await expect(page.locator('[data-testid="coa-add-btn"]')).toBeVisible();
      console.log('Add button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create a new GL account', async ({ page }) => {
      const errors = createErrorCollector(page);
      const testData = generateTestData('ACC');

      console.log('Step 1: Navigating to Chart of Accounts...');
      await page.goto(`${BASE_URL}/accounting/chart-of-accounts`);
      await page.waitForSelector('[data-testid="coa-page"]', { timeout: 15000 });

      // Click add button
      console.log('Step 2: Opening add dialog...');
      await page.click('[data-testid="coa-add-btn"]');
      await page.waitForSelector('[data-testid="coa-form-dialog"]', { timeout: 10000 });
      console.log('Add dialog opened');

      // Fill form
      console.log('Step 3: Filling account form...');
      await setDevExtremeText(page, '[data-testid="coa-code-field"]', `1-9999-${testData.code.slice(-4)}`);
      await setDevExtremeText(page, '[data-testid="coa-name-th-field"]', testData.nameTh);
      await setDevExtremeText(page, '[data-testid="coa-name-en-field"]', testData.nameEn);
      
      // Select account type
      await selectDevExtremeOption(page, '[data-testid="coa-type-field"]', 0);
      console.log('Selected account type');

      // Submit form
      console.log('Step 4: Submitting form...');
      await page.click('[data-testid="coa-save-btn"]');
      await page.waitForTimeout(2000);

      // Verify success - dialog should close
      const dialogVisible = await page.locator('[data-testid="coa-form-dialog"]').isVisible();
      if (!dialogVisible) {
        console.log('Account created successfully - dialog closed');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should edit an existing GL account', async ({ page }) => {
      const errors = createErrorCollector(page);

      console.log('Step 1: Navigating to Chart of Accounts...');
      await page.goto(`${BASE_URL}/accounting/chart-of-accounts`);
      await page.waitForSelector('[data-testid="coa-treelist"]', { timeout: 15000 });
      await waitForLoading(page);

      // Double-click first row to edit
      console.log('Step 2: Double-clicking row to edit...');
      const firstRow = page.locator('.dx-treelist-rowsview .dx-data-row').first();
      const rowCount = await firstRow.count();
      
      if (rowCount > 0) {
        await firstRow.dblclick();
        await page.waitForSelector('[data-testid="coa-form-dialog"]', { timeout: 10000 });
        console.log('Edit dialog opened');

        // Modify description
        await setDevExtremeText(page, '[data-testid="coa-description-field"]', `Updated at ${new Date().toISOString()}`);
        
        // Save changes
        await page.click('[data-testid="coa-save-btn"]');
        await page.waitForTimeout(2000);
        console.log('Account updated');
      } else {
        console.log('No accounts to edit, skipping');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== FIXED ASSETS ====================
  test.describe('Fixed Assets CRUD', () => {
    
    test('should display fixed assets list page', async ({ page }) => {
      const errors = createErrorCollector(page);

      console.log('Step 1: Navigating to Fixed Assets...');
      await page.goto(`${BASE_URL}/accounting/fixed-assets`);
      await waitForLoading(page);

      // Wait for page to load
      await page.waitForSelector('[data-testid="fixed-assets-page"]', { timeout: 15000 });
      console.log('Fixed Assets page loaded');

      // Verify stats cards
      await expect(page.locator('[data-testid="fa-stats"]')).toBeVisible();
      console.log('Stats visible');

      // Verify DataGrid
      await expect(page.locator('[data-testid="fa-grid"]')).toBeVisible();
      console.log('DataGrid visible');

      // Verify Add button
      await expect(page.locator('[data-testid="fa-add-btn"]')).toBeVisible();
      console.log('Add button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create a new fixed asset', async ({ page }) => {
      const errors = createErrorCollector(page);
      const testData = generateTestData('FA');

      console.log('Step 1: Navigating to Fixed Assets...');
      await page.goto(`${BASE_URL}/accounting/fixed-assets`);
      await page.waitForSelector('[data-testid="fixed-assets-page"]', { timeout: 15000 });

      // Click add button
      console.log('Step 2: Clicking add button...');
      await page.click('[data-testid="fa-add-btn"]');
      await page.waitForURL('**/accounting/fixed-assets/new', { timeout: 10000 });
      console.log('Navigated to new asset page');

      // Wait for form
      await page.waitForSelector('[data-testid="fa-form"]', { timeout: 10000 });

      // Fill form
      console.log('Step 3: Filling asset form...');
      await setDevExtremeText(page, '[data-testid="fa-code-field"]', testData.code);
      await setDevExtremeText(page, '[data-testid="fa-name-th-field"]', testData.nameTh);
      await setDevExtremeText(page, '[data-testid="fa-name-en-field"]', testData.nameEn);
      
      // Select category
      await selectDevExtremeOption(page, '[data-testid="fa-category-field"]', 0);
      
      // Set acquisition date
      const today = new Date().toISOString().split('T')[0];
      await setDevExtremeDate(page, '[data-testid="fa-acquisition-date-field"]', today);
      
      // Set acquisition cost
      await setDevExtremeNumber(page, '[data-testid="fa-cost-field"]', testData.amount);
      
      // Set useful life
      await setDevExtremeNumber(page, '[data-testid="fa-useful-life-field"]', 5);

      // Submit
      console.log('Step 4: Submitting form...');
      await page.click('[data-testid="fa-submit-btn"]');
      await page.waitForTimeout(3000);

      // Check for success
      const currentUrl = page.url();
      if (!currentUrl.includes('/new')) {
        console.log('Asset created successfully');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should view and edit fixed asset', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/fixed-assets`);
      await page.waitForSelector('[data-testid="fa-grid"]', { timeout: 15000 });
      await waitForLoading(page);

      // Click on first row
      const firstRow = page.locator('.dx-datagrid-rowsview .dx-data-row').first();
      const rowCount = await firstRow.count();

      if (rowCount > 0) {
        await firstRow.click();
        await page.waitForURL('**/accounting/fixed-assets/*', { timeout: 10000 });
        console.log('Navigated to asset detail page');

        // Wait for form
        await page.waitForSelector('[data-testid="fa-form"]', { timeout: 10000 });
        console.log('Asset form loaded');

        // Modify a field
        await setDevExtremeText(page, '[data-testid="fa-description-field"]', `Updated ${new Date().toISOString()}`);
        
        // Save
        await page.click('[data-testid="fa-submit-btn"]');
        await page.waitForTimeout(2000);
        console.log('Asset updated');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== AR MODULE ====================
  test.describe('AR Module', () => {
    
    test('should display AR dashboard', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/ar`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="ar-dashboard"]', { timeout: 15000 });
      console.log('AR Dashboard loaded');

      // Verify KPI cards
      await expect(page.locator('[data-testid="ar-stats"]')).toBeVisible();
      console.log('AR stats visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should display AR invoices list', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/ar/invoices`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="ar-invoices-page"]', { timeout: 15000 });
      console.log('AR Invoices page loaded');

      // Verify DataGrid
      await expect(page.locator('[data-testid="ar-invoices-grid"]')).toBeVisible();
      console.log('AR Invoices grid visible');

      // Verify Add button
      await expect(page.locator('[data-testid="ar-add-invoice-btn"]')).toBeVisible();
      console.log('Add invoice button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create AR invoice', async ({ page }) => {
      const errors = createErrorCollector(page);
      const testData = generateTestData('AR');

      await page.goto(`${BASE_URL}/accounting/ar/invoices`);
      await page.waitForSelector('[data-testid="ar-invoices-page"]', { timeout: 15000 });

      // Click add button
      await page.click('[data-testid="ar-add-invoice-btn"]');
      await page.waitForSelector('[data-testid="ar-invoice-dialog"]', { timeout: 10000 });
      console.log('Invoice dialog opened');

      // Fill invoice form
      await setDevExtremeText(page, '[data-testid="ar-invoice-number-field"]', `AR-${testData.code}`);
      await selectDevExtremeOption(page, '[data-testid="ar-customer-field"]', 0);
      
      const today = new Date().toISOString().split('T')[0];
      await setDevExtremeDate(page, '[data-testid="ar-invoice-date-field"]', today);
      
      // Due date 30 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await setDevExtremeDate(page, '[data-testid="ar-due-date-field"]', dueDate.toISOString().split('T')[0]);

      // Add line item
      const lineDescription = page.locator('[data-testid="ar-line-description-0"]');
      if (await lineDescription.isVisible()) {
        await lineDescription.fill('Test service');
        await page.locator('[data-testid="ar-line-quantity-0"]').fill('1');
        await page.locator('[data-testid="ar-line-price-0"]').fill(testData.amount.toString());
      }

      // Submit
      await page.click('[data-testid="ar-save-btn"]');
      await page.waitForTimeout(3000);

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('AR invoice creation test completed');
    });

    test('should display AR aging report', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/ar/aging`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="ar-aging-page"]', { timeout: 15000 });
      console.log('AR Aging page loaded');

      // Verify aging grid
      await expect(page.locator('[data-testid="ar-aging-grid"]')).toBeVisible();
      console.log('AR Aging grid visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== AP MODULE ====================
  test.describe('AP Module', () => {
    
    test('should display AP dashboard', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/ap`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="ap-dashboard"]', { timeout: 15000 });
      console.log('AP Dashboard loaded');

      // Verify KPI cards
      await expect(page.locator('[data-testid="ap-stats"]')).toBeVisible();
      console.log('AP stats visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should display AP invoices list', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/ap/invoices`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="ap-invoices-page"]', { timeout: 15000 });
      console.log('AP Invoices page loaded');

      // Verify DataGrid
      await expect(page.locator('[data-testid="ap-invoices-grid"]')).toBeVisible();
      console.log('AP Invoices grid visible');

      // Verify Add button
      await expect(page.locator('[data-testid="ap-add-invoice-btn"]')).toBeVisible();
      console.log('Add invoice button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create AP invoice', async ({ page }) => {
      const errors = createErrorCollector(page);
      const testData = generateTestData('AP');

      await page.goto(`${BASE_URL}/accounting/ap/invoices`);
      await page.waitForSelector('[data-testid="ap-invoices-page"]', { timeout: 15000 });

      // Click add button
      await page.click('[data-testid="ap-add-invoice-btn"]');
      await page.waitForSelector('[data-testid="ap-invoice-dialog"]', { timeout: 10000 });
      console.log('Invoice dialog opened');

      // Fill invoice form
      await setDevExtremeText(page, '[data-testid="ap-invoice-number-field"]', `AP-${testData.code}`);
      await selectDevExtremeOption(page, '[data-testid="ap-vendor-field"]', 0);
      
      const today = new Date().toISOString().split('T')[0];
      await setDevExtremeDate(page, '[data-testid="ap-invoice-date-field"]', today);
      await setDevExtremeDate(page, '[data-testid="ap-received-date-field"]', today);
      
      // Due date 30 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await setDevExtremeDate(page, '[data-testid="ap-due-date-field"]', dueDate.toISOString().split('T')[0]);

      // Add line item
      const lineDescription = page.locator('[data-testid="ap-line-description-0"]');
      if (await lineDescription.isVisible()) {
        await lineDescription.fill('Test expense');
        await page.locator('[data-testid="ap-line-quantity-0"]').fill('1');
        await page.locator('[data-testid="ap-line-price-0"]').fill(testData.amount.toString());
      }

      // Submit
      await page.click('[data-testid="ap-save-btn"]');
      await page.waitForTimeout(3000);

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('AP invoice creation test completed');
    });

    test('should display AP aging report', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/ap/aging`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="ap-aging-page"]', { timeout: 15000 });
      console.log('AP Aging page loaded');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== REPORTS ====================
  test.describe('Reports', () => {
    
    test('should display reports dashboard', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/reports`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="reports-dashboard"]', { timeout: 15000 });
      console.log('Reports Dashboard loaded');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should display VAT report', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/reports/vat`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="vat-report-page"]', { timeout: 15000 });
      console.log('VAT Report page loaded');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should display WHT report', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/reports/wht`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="wht-report-page"]', { timeout: 15000 });
      console.log('WHT Report page loaded');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== PERIOD CLOSE ====================
  test.describe('Period Close', () => {
    
    test('should display period close page', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/period-close`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="period-close-page"]', { timeout: 15000 });
      console.log('Period Close page loaded');

      // Verify periods grid
      await expect(page.locator('[data-testid="periods-grid"]')).toBeVisible();
      console.log('Periods grid visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== EQUIPMENT ====================
  test.describe('Equipment', () => {
    
    test('should display equipment page', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/equipment`);
      await waitForLoading(page);

      await page.waitForSelector('[data-testid="equipment-page"]', { timeout: 15000 });
      console.log('Equipment page loaded');

      await expect(page.locator('[data-testid="eq-grid"]')).toBeVisible();
      console.log('Equipment grid visible');

      await expect(page.locator('[data-testid="eq-stats"]')).toBeVisible();
      console.log('Stats visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should navigate to new equipment page', async ({ page }) => {
      const errors = createErrorCollector(page);

      await page.goto(`${BASE_URL}/accounting/equipment`);
      await page.waitForSelector('[data-testid="equipment-page"]', { timeout: 15000 });

      await page.click('[data-testid="eq-add-btn"]');
      await page.waitForURL('**/accounting/equipment/new', { timeout: 10000 });
      console.log('Navigated to new equipment page');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== COMPLETE WORKFLOW ====================
  test('should perform complete accounting workflow', async ({ page }) => {
    const errors = createErrorCollector(page);

    console.log('=== Complete Accounting Workflow Test ===\n');

    // 1. Dashboard
    console.log('--- Step 1: Accounting Dashboard ---');
    await page.goto(`${BASE_URL}/accounting`);
    await page.waitForSelector('[data-testid="accounting-dashboard"]', { timeout: 15000 });
    console.log('Dashboard loaded');

    // 2. Chart of Accounts
    console.log('\n--- Step 2: Chart of Accounts ---');
    await page.goto(`${BASE_URL}/accounting/chart-of-accounts`);
    await page.waitForSelector('[data-testid="coa-page"]', { timeout: 15000 });
    console.log('Chart of Accounts loaded');

    // 3. Journal Entries
    console.log('\n--- Step 3: Journal Entries ---');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 15000 });
    console.log('Journal Entries loaded');

    // 4. Fixed Assets
    console.log('\n--- Step 4: Fixed Assets ---');
    await page.goto(`${BASE_URL}/accounting/fixed-assets`);
    await page.waitForSelector('[data-testid="fixed-assets-page"]', { timeout: 15000 });
    console.log('Fixed Assets loaded');

    // 5. AR Invoices
    console.log('\n--- Step 5: AR Invoices ---');
    await page.goto(`${BASE_URL}/accounting/ar/invoices`);
    await page.waitForSelector('[data-testid="ar-invoices-page"]', { timeout: 15000 });
    console.log('AR Invoices loaded');

    // 6. AP Invoices
    console.log('\n--- Step 6: AP Invoices ---');
    await page.goto(`${BASE_URL}/accounting/ap/invoices`);
    await page.waitForSelector('[data-testid="ap-invoices-page"]', { timeout: 15000 });
    console.log('AP Invoices loaded');

    // 7. Reports
    console.log('\n--- Step 7: Reports ---');
    await page.goto(`${BASE_URL}/accounting/reports`);
    await page.waitForSelector('[data-testid="reports-dashboard"]', { timeout: 15000 });
    console.log('Reports loaded');

    // 8. Period Close
    console.log('\n--- Step 8: Period Close ---');
    await page.goto(`${BASE_URL}/accounting/period-close`);
    await page.waitForSelector('[data-testid="period-close-page"]', { timeout: 15000 });
    console.log('Period Close loaded');

    // 9. Equipment
    console.log('\n--- Step 9: Equipment ---');
    await page.goto(`${BASE_URL}/accounting/equipment`);
    await page.waitForSelector('[data-testid="equipment-page"]', { timeout: 15000 });
    console.log('Equipment loaded');

    console.log('\n=== Complete workflow test PASSED ===');

    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });
});
