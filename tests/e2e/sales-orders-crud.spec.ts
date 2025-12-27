/**
 * Playwright E2E test for Sales Orders CRUD Operations
 * Tests complete sales order workflow including:
 * - Displaying the sales orders list page
 * - Creating a new sales order
 * - Viewing sales order detail
 *
 * Run with: npx playwright test tests/e2e/sales-orders-crud.spec.ts --headed
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
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/login`);

  // Wait for login form to load
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  console.log('Login page loaded');

  // Fill in credentials
  await page.fill('input[type="email"]', TEST_USER.email);
  console.log(`Filled email: ${TEST_USER.email}`);

  await page.fill('input[type="password"]', TEST_USER.password);
  console.log('Filled password');

  // Submit login
  await page.click('button[type="submit"]');
  console.log('Submitted login form');

  // Wait for redirect
  await page.waitForURL(url => {
    const urlStr = String(url);
    return urlStr.includes('/dashboard') || urlStr.includes('/sales') || urlStr.includes('/accounting');
  }, { timeout: 15000 });
  console.log('Login successful');
}

// Helper function to generate unique test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    description: `Test Sales Order ${timestamp}`,
    referenceNumber: `REF-${timestamp}`,
  };
}

// Helper function to navigate to sales orders page
async function navigateToSalesOrders(page: Page) {
  console.log('Navigating to sales orders page...');
  await page.goto(`${BASE_URL}/sales/orders`);

  // Wait for the page to load - check for the data grid or add button
  await page.waitForSelector('[data-testid="so-add-btn"], [data-testid="so-data-grid"]', { timeout: 15000 });
  console.log('Sales orders page loaded');
}

test.describe('Sales Orders CRUD E2E Tests', () => {
  // Store console errors for each test
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Reset console errors
    consoleErrors = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore network errors that are transient
        if (!text.includes('net::ERR_') && !text.includes('Failed to load resource')) {
          consoleErrors.push(text);
        }
      }
    });

    // Login before each test
    await login(page);
  });

  test('should display sales orders list page', async ({ page }) => {
    console.log('Step 1: Navigating to sales orders page...');
    await navigateToSalesOrders(page);

    // Verify page elements
    console.log('Verifying page elements...');

    // Check for add button
    const addButton = page.locator('[data-testid="so-add-btn"]');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    console.log('Add button visible');

    // Check for data grid or status tabs
    const statusTabs = page.locator('[data-testid^="so-status-tab-"]');
    const tabCount = await statusTabs.count();
    expect(tabCount).toBeGreaterThan(0);
    console.log(`Found ${tabCount} status tabs`);

    // Check for search container
    const searchContainer = page.locator('[data-testid="so-search-container"]');
    await expect(searchContainer).toBeVisible({ timeout: 5000 });
    console.log('Search container visible');

    console.log('Sales orders list page test completed successfully');
  });

  test('should create a new sales order', async ({ page }) => {
    const testData = generateTestData();

    console.log('Step 1: Navigating to sales orders page...');
    await navigateToSalesOrders(page);

    console.log('Step 2: Clicking "Add" button...');
    const addButton = page.locator('[data-testid="so-add-btn"]');
    await addButton.click();
    console.log('Clicked add button');

    // Wait for navigation to new order page
    await page.waitForURL('**/sales/orders/new', { timeout: 10000 });
    console.log('Navigated to new order page');

    // Wait for form to load
    await page.waitForSelector('[data-testid="so-form-title"]', { timeout: 10000 });
    console.log('Form loaded');

    // Verify form title
    const formTitle = page.locator('[data-testid="so-form-title"]');
    await expect(formTitle).toBeVisible();
    console.log('Form title verified');

    console.log('Step 3: Selecting customer...');
    // Click customer selection button
    const selectCustomerBtn = page.locator('[data-testid="so-select-customer-btn"]');
    await selectCustomerBtn.click();
    console.log('Clicked select customer button');

    // Wait for customer dialog to appear
    await page.waitForSelector('[data-testid="customer-search-container"]', { timeout: 10000 });
    console.log('Customer dialog appeared');

    // Search for a customer (empty search to get all)
    await page.waitForTimeout(1000); // Wait for initial load

    // Click on the first customer result (wait for results to load)
    const customerResults = page.locator('[data-testid^="customer-result-"]');
    await customerResults.first().waitFor({ state: 'visible', timeout: 10000 });
    const firstCustomerCode = await customerResults.first().getAttribute('data-testid');
    console.log(`Selecting customer: ${firstCustomerCode}`);
    await customerResults.first().click();
    console.log('Selected customer');

    // Wait for dialog to close
    await page.waitForTimeout(500);

    console.log('Step 4: Adding items...');
    // Click add item button
    const addItemBtn = page.locator('[data-testid="so-add-item-btn"]');
    await addItemBtn.click();
    console.log('Clicked add item button');

    // Wait for item dialog to appear
    await page.waitForSelector('[data-testid="item-search-container"]', { timeout: 10000 });
    console.log('Item dialog appeared');

    // Wait for items to load
    await page.waitForTimeout(1000);

    // The item dialog has a "Select" button in each row - click the first one
    const selectButton = page.locator('[data-testid^="item-select-btn-"]').first();
    await selectButton.waitFor({ state: 'visible', timeout: 10000 });
    await selectButton.click();
    console.log('Clicked Select button for first item');

    // Wait for dialog to close
    await page.waitForTimeout(500);

    // Verify item was added to the grid
    const linesGrid = page.locator('[data-testid="so-lines-grid"]');
    await expect(linesGrid).toBeVisible({ timeout: 5000 });
    console.log('Item added to order lines');

    // Set quantity for the line item
    console.log('Step 5: Setting quantity...');
    // Find the quantity input in the lines grid (use .dx-texteditor-input for visible input)
    const quantityInput = linesGrid.locator('.dx-numberbox .dx-texteditor-input').first();
    await quantityInput.waitFor({ state: 'visible', timeout: 5000 });
    await quantityInput.click();
    await quantityInput.fill('10');
    await page.waitForTimeout(300);
    console.log('Set quantity to 10');

    // Set unit price
    const priceInputs = linesGrid.locator('.dx-numberbox .dx-texteditor-input');
    if (await priceInputs.count() > 1) {
      await priceInputs.nth(1).click();
      await priceInputs.nth(1).fill('100');
      await page.waitForTimeout(300);
      console.log('Set unit price to 100');
    }

    console.log('Step 6: Saving the order...');
    // Click save button
    const saveButton = page.locator('[data-testid="so-save-btn"]');
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    console.log('Clicked save button');

    // Wait for redirect to detail page (app redirects to /sales/orders/{id} after creation)
    await page.waitForURL(/\/sales\/orders\/\d+/, { timeout: 15000 });
    console.log('Redirected to detail page');

    // Verify we're on the detail page
    await page.waitForTimeout(1000);
    const pageUrl = page.url();
    expect(pageUrl).toMatch(/\/sales\/orders\/\d+/);
    console.log(`Created sales order: ${pageUrl}`);

    console.log('Sales order creation test completed successfully');
  });

  test('should view sales order detail', async ({ page }) => {
    console.log('Step 1: Navigating to sales orders page...');
    await navigateToSalesOrders(page);

    // Wait for grid to load
    await page.waitForSelector('[data-testid="so-data-grid"]', { timeout: 10000 });
    console.log('Data grid loaded');

    console.log('Step 2: Clicking on first order...');
    // Click on the first row in the data grid
    const firstRow = page.locator('[data-testid="so-data-grid"] .dx-datagrid-rowsview .dx-data-row').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.click();
    console.log('Clicked on first order');

    // Wait for navigation to detail page
    await page.waitForURL(/\/sales\/orders\/\d+/, { timeout: 10000 });
    console.log('Navigated to detail page');

    // Verify detail page loaded
    await page.waitForTimeout(1000);

    // Check for back button or some detail page element
    const pageContent = await page.content();
    expect(pageContent).toContain('SO');
    console.log('Detail page content verified');

    console.log('Sales order view test completed successfully');
  });

  test('should filter orders by status', async ({ page }) => {
    console.log('Step 1: Navigating to sales orders page...');
    await navigateToSalesOrders(page);

    console.log('Step 2: Clicking on draft status tab...');
    // Click on draft status tab
    const draftTab = page.locator('[data-testid="so-status-tab-draft"]');
    await draftTab.click();
    console.log('Clicked draft tab');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify the tab is active (has different styling)
    await expect(draftTab).toHaveClass(/bg-slate/);
    console.log('Draft tab is active');

    console.log('Step 3: Clicking on all status tab...');
    // Click on all status tab
    const allTab = page.locator('[data-testid="so-status-tab-all"]');
    await allTab.click();
    console.log('Clicked all tab');

    await page.waitForTimeout(500);

    console.log('Status filter test completed successfully');
  });

  test('should search for orders', async ({ page }) => {
    console.log('Step 1: Navigating to sales orders page...');
    await navigateToSalesOrders(page);

    console.log('Step 2: Entering search term...');
    // Find search input
    const searchInput = page.locator('[data-testid="so-search-input"] input');
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('SO');
    console.log('Entered search term');

    // Wait for search to apply
    await page.waitForTimeout(500);

    console.log('Search test completed successfully');
  });
});
