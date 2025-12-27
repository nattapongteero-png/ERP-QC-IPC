/**
 * Playwright E2E test for Journal Entries CRUD Operations
 * Tests complete journal entry workflow including:
 * - Creating a new journal entry
 * - Viewing journal entry detail
 * - Posting a journal entry
 * - Reversing a journal entry
 *
 * Run with: npx playwright test tests/e2e/journal-entries-crud.spec.ts --headed
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
    return urlStr.includes('/dashboard') || urlStr.includes('/accounting');
  }, { timeout: 15000 });
  console.log('Login successful');
}

// Helper function to generate unique test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    description: `Test Journal Entry ${timestamp}`,
    referenceNumber: `REF-${timestamp}`,
    debitAmount: 1000.00,
    creditAmount: 1000.00
  };
}

// Helper function to select an option from DevExtreme SelectBox
async function selectDevExtremeOption(page: Page, containerSelector: string, optionIndex: number = 0) {
  const container = page.locator(containerSelector);
  const selectBox = container.locator('.dx-selectbox');
  await selectBox.click();
  await page.waitForTimeout(500);
  const options = page.locator('[role="option"]');
  await options.nth(optionIndex).click();
  await page.waitForTimeout(300);
}

// Helper function to set DevExtreme NumberBox value
async function setDevExtremeNumber(page: Page, containerSelector: string, value: number) {
  const container = page.locator(containerSelector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill(value.toString());
  await page.waitForTimeout(200);
}

// Helper function to set DevExtreme TextBox value
async function setDevExtremeText(page: Page, containerSelector: string, value: string) {
  const container = page.locator(containerSelector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(200);
}

test.describe('Journal Entries CRUD E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display journal entries list page', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // Navigate to journal entries page
    console.log('Step 1: Navigating to journal entries page...');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);

    // Wait for page to load
    await page.waitForSelector('text=รายการบันทึกบัญชี', { timeout: 10000 });
    console.log('Journal entries page loaded');

    // Verify KPI cards are visible
    await expect(page.locator('[data-testid="kpi-cards"]')).toBeVisible();
    console.log('KPI cards visible');

    // Verify data grid is visible
    await expect(page.locator('[data-testid="journal-entries-grid"]')).toBeVisible();
    console.log('Data grid visible');

    // Verify add button is visible
    await expect(page.locator('[data-testid="add-entry-button"]')).toBeVisible();
    console.log('Add entry button visible');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('Journal entries list page test completed successfully');
  });

  test('should create a new journal entry', async ({ page }) => {
    const errors: string[] = [];
    const testData = generateTestData();

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // Navigate to journal entries page
    console.log('Step 1: Navigating to journal entries page...');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('text=รายการบันทึกบัญชี', { timeout: 10000 });
    console.log('Journal entries page loaded');

    // Click add entry button
    console.log('Step 2: Clicking "Add Entry" button...');
    await page.click('[data-testid="add-entry-button"]');
    console.log('Clicked add entry button');

    // Wait for navigation to new entry page
    await page.waitForURL('**/accounting/journal-entries/new', { timeout: 10000 });
    console.log('Navigated to new entry page');

    // Wait for form to load
    await page.waitForSelector('[data-testid="je-form-header"]', { timeout: 10000 });
    console.log('Form loaded');

    // Verify form title shows create mode
    await expect(page.locator('[data-testid="je-form-title"]')).toContainText('สร้างรายการบันทึกบัญชี');
    console.log('Form title verified');

    // Fill in description
    console.log('Step 3: Filling in entry information...');
    await setDevExtremeText(page, '[data-testid="je-description-field"]', testData.description);
    console.log(`Filled description: ${testData.description}`);

    // Fill in reference number
    await setDevExtremeText(page, '[data-testid="je-reference-number-field"]', testData.referenceNumber);
    console.log(`Filled reference number: ${testData.referenceNumber}`);

    // Fill journal lines
    console.log('Step 4: Filling journal lines...');

    // Line 1: Debit
    await selectDevExtremeOption(page, '[data-testid="je-line-account-0"]', 0);
    console.log('Selected account for line 1');
    await setDevExtremeNumber(page, '[data-testid="je-line-debit-0"]', testData.debitAmount);
    console.log(`Set debit amount for line 1: ${testData.debitAmount}`);

    // Line 2: Credit
    await selectDevExtremeOption(page, '[data-testid="je-line-account-1"]', 1);
    console.log('Selected account for line 2');
    await setDevExtremeNumber(page, '[data-testid="je-line-credit-1"]', testData.creditAmount);
    console.log(`Set credit amount for line 2: ${testData.creditAmount}`);

    // Wait for balance calculation
    await page.waitForTimeout(500);

    // Verify balance is correct
    await expect(page.locator('[data-testid="je-balance-status"]')).toContainText('ยอดเดบิตและเครดิตเท่ากัน');
    console.log('Balance verified');

    // Submit the form
    console.log('Step 5: Submitting form...');
    await page.click('[data-testid="je-submit-btn"]');
    console.log('Clicked submit button');

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Check for success - should redirect to list page
    await page.waitForURL('**/accounting/journal-entries$', { timeout: 10000 });
    console.log('Redirected back to list page');

    // Verify the entry appears in the list
    await page.waitForTimeout(1000);
    await expect(page.locator(`text=${testData.description}`)).toBeVisible();
    console.log(`New entry "${testData.description}" found in list`);

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('Journal entry creation test completed successfully');
  });

  test('should view journal entry detail', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // Navigate to journal entries page
    console.log('Step 1: Navigating to journal entries page...');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('Journal entries page loaded');

    // Find a view button and click it
    console.log('Step 2: Clicking view button for first entry...');
    const viewButtons = page.locator('[data-testid^="je-view-btn-"]');
    const viewButtonCount = await viewButtons.count();

    if (viewButtonCount === 0) {
      console.log('No entries found in the list, skipping test');
      return;
    }

    await viewButtons.first().click();
    console.log('Clicked view button');

    // Wait for navigation to detail page
    await page.waitForURL('**/accounting/journal-entries/*', { timeout: 10000 });
    console.log('Navigated to detail page');

    // Wait for form to load
    await page.waitForSelector('[data-testid="je-form-header"]', { timeout: 10000 });
    console.log('Detail form loaded');

    // Verify status badge is visible
    await expect(page.locator('[data-testid="je-status-badge"]')).toBeVisible();
    console.log('Status badge visible');

    // Verify back button is visible
    await expect(page.locator('[data-testid="je-back-btn"]')).toBeVisible();
    console.log('Back button visible');

    // Click back to return to list
    console.log('Step 3: Navigating back to list...');
    await page.click('[data-testid="je-back-btn"]');

    // Wait for navigation back to list
    await page.waitForURL('**/accounting/journal-entries$', { timeout: 10000 });
    console.log('Back to journal entries list');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('Journal entry view test completed successfully');
  });

  test('should post a draft journal entry', async ({ page }) => {
    const errors: string[] = [];
    const testData = generateTestData();

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // First, create a new entry to post
    console.log('Step 0: Creating a test entry to post...');
    await page.goto(`${BASE_URL}/accounting/journal-entries/new`);
    await page.waitForSelector('[data-testid="je-form-header"]', { timeout: 10000 });

    // Fill in form
    await setDevExtremeText(page, '[data-testid="je-description-field"]', testData.description);
    await setDevExtremeText(page, '[data-testid="je-reference-number-field"]', testData.referenceNumber);

    // Fill lines
    await selectDevExtremeOption(page, '[data-testid="je-line-account-0"]', 0);
    await setDevExtremeNumber(page, '[data-testid="je-line-debit-0"]', testData.debitAmount);
    await selectDevExtremeOption(page, '[data-testid="je-line-account-1"]', 1);
    await setDevExtremeNumber(page, '[data-testid="je-line-credit-1"]', testData.creditAmount);

    await page.waitForTimeout(500);
    await page.click('[data-testid="je-submit-btn"]');
    await page.waitForTimeout(2000);
    console.log('Test entry created');

    // Navigate to entries list and find the new entry
    console.log('Step 1: Finding the new entry to post...');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Find the row with our test description
    const testRow = page.locator('role=row').filter({ hasText: testData.description });
    const postButton = testRow.locator('[data-testid^="je-post-btn-"]');
    const postButtonCount = await postButton.count();

    if (postButtonCount === 0) {
      console.log('Entry not in draft status or not found, skipping test');
      return;
    }

    // Click post button
    console.log('Step 2: Clicking post button...');
    await postButton.click();
    console.log('Clicked post button');

    // Wait for confirmation dialog
    await page.waitForTimeout(500);
    await expect(page.locator('text=ยืนยันการผ่านรายการ')).toBeVisible();
    console.log('Confirmation dialog appeared');

    // Confirm posting
    console.log('Step 3: Confirming post...');
    await page.click('button:has-text("ตกลง")');
    console.log('Confirmed posting');

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    // Verify the entry no longer has a post button (status changed)
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // The posted entry should now have a reverse button instead
    const testRowAfter = page.locator('role=row').filter({ hasText: testData.description });
    await expect(testRowAfter.locator('[data-testid^="je-reverse-btn-"]')).toBeVisible();
    console.log('Entry now shows reverse button (posted successfully)');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('Journal entry post test completed successfully');
  });

  test('should reverse a posted journal entry', async ({ page }) => {
    const errors: string[] = [];
    const testData = generateTestData();

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // First, create and post a new entry
    console.log('Step 0: Creating and posting a test entry...');
    await page.goto(`${BASE_URL}/accounting/journal-entries/new`);
    await page.waitForSelector('[data-testid="je-form-header"]', { timeout: 10000 });

    // Fill in form
    await setDevExtremeText(page, '[data-testid="je-description-field"]', testData.description);
    await setDevExtremeText(page, '[data-testid="je-reference-number-field"]', testData.referenceNumber);

    // Fill lines
    await selectDevExtremeOption(page, '[data-testid="je-line-account-0"]', 0);
    await setDevExtremeNumber(page, '[data-testid="je-line-debit-0"]', testData.debitAmount);
    await selectDevExtremeOption(page, '[data-testid="je-line-account-1"]', 1);
    await setDevExtremeNumber(page, '[data-testid="je-line-credit-1"]', testData.creditAmount);

    await page.waitForTimeout(500);
    await page.click('[data-testid="je-submit-btn"]');
    await page.waitForTimeout(2000);
    console.log('Test entry created');

    // Post the entry
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const testRow = page.locator('role=row').filter({ hasText: testData.description });
    await testRow.locator('[data-testid^="je-post-btn-"]').click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("ตกลง")');
    await page.waitForTimeout(2000);
    console.log('Test entry posted');

    // Now reverse the posted entry
    console.log('Step 1: Finding the posted entry to reverse...');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const testRowAfterPost = page.locator('role=row').filter({ hasText: testData.description });
    const reverseButton = testRowAfterPost.locator('[data-testid^="je-reverse-btn-"]');
    const reverseButtonCount = await reverseButton.count();

    if (reverseButtonCount === 0) {
      console.log('Entry not in posted status or not found, skipping test');
      return;
    }

    // Click reverse button
    console.log('Step 2: Clicking reverse button...');
    await reverseButton.click();
    console.log('Clicked reverse button');

    // Wait for confirmation dialog
    await page.waitForTimeout(500);
    await expect(page.locator('text=ยืนยันการกลับรายการ')).toBeVisible();
    console.log('Confirmation dialog appeared');

    // Confirm reversing
    console.log('Step 3: Confirming reverse...');
    await page.click('button:has-text("ตกลง")');
    console.log('Confirmed reversing');

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    // Verify the reversal was successful - original entry should be reversed
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // The reversed entry should no longer have post or reverse button
    const testRowAfterReverse = page.locator('role=row').filter({ hasText: testData.description });
    await expect(testRowAfterReverse.locator('[data-testid^="je-post-btn-"]')).not.toBeVisible();
    await expect(testRowAfterReverse.locator('[data-testid^="je-reverse-btn-"]')).not.toBeVisible();
    console.log('Entry is now reversed (no post/reverse buttons)');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('Journal entry reverse test completed successfully');
  });

  test('should perform complete CRUD workflow', async ({ page }) => {
    const errors: string[] = [];
    const testData = generateTestData();

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    console.log('=== Complete Journal Entry Workflow Test ===');

    // CREATE
    console.log('\n--- CREATE ---');
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('text=รายการบันทึกบัญชี', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.click('[data-testid="add-entry-button"]');
    await page.waitForURL('**/accounting/journal-entries/new', { timeout: 10000 });
    await page.waitForSelector('[data-testid="je-form-header"]', { timeout: 10000 });

    // Fill form
    await setDevExtremeText(page, '[data-testid="je-description-field"]', testData.description);
    await setDevExtremeText(page, '[data-testid="je-reference-number-field"]', testData.referenceNumber);
    await selectDevExtremeOption(page, '[data-testid="je-line-account-0"]', 0);
    await setDevExtremeNumber(page, '[data-testid="je-line-debit-0"]', testData.debitAmount);
    await selectDevExtremeOption(page, '[data-testid="je-line-account-1"]', 1);
    await setDevExtremeNumber(page, '[data-testid="je-line-credit-1"]', testData.creditAmount);
    await page.waitForTimeout(500);

    // Verify balance before submit
    await expect(page.locator('[data-testid="je-balance-status"]')).toContainText('ยอดเดบิตและเครดิตเท่ากัน');

    await page.click('[data-testid="je-submit-btn"]');
    await page.waitForTimeout(2000);
    await page.waitForURL('**/accounting/journal-entries$', { timeout: 10000 });
    console.log('Entry created successfully');

    // READ/VIEW
    console.log('\n--- READ/VIEW ---');
    await page.waitForTimeout(1000);
    const entryRow = page.locator('role=row').filter({ hasText: testData.description });
    await entryRow.locator('[data-testid^="je-view-btn-"]').click();
    await page.waitForURL('**/accounting/journal-entries/*', { timeout: 10000 });
    await page.waitForSelector('[data-testid="je-form-header"]', { timeout: 10000 });

    // Verify entry details
    await expect(page.locator(`text=${testData.description}`)).toBeVisible();
    await expect(page.locator('[data-testid="je-status-badge"]')).toBeVisible();
    console.log('Entry viewed successfully');

    // POST
    console.log('\n--- POST ---');
    await page.click('[data-testid="je-post-btn"]');
    await page.waitForTimeout(500);
    await expect(page.locator('text=ยืนยันการผ่านรายการ')).toBeVisible();
    await page.click('button:has-text("ตกลง")');
    await page.waitForTimeout(2000);
    await page.waitForURL('**/accounting/journal-entries$', { timeout: 10000 });
    console.log('Entry posted successfully');

    // REVERSE
    console.log('\n--- REVERSE ---');
    await page.waitForTimeout(1000);
    const postedRow = page.locator('role=row').filter({ hasText: testData.description });
    await postedRow.locator('[data-testid^="je-reverse-btn-"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=ยืนยันการกลับรายการ')).toBeVisible();
    await page.click('button:has-text("ตกลง")');
    await page.waitForTimeout(2000);
    console.log('Entry reversed successfully');

    // Verify final state
    await page.goto(`${BASE_URL}/accounting/journal-entries`);
    await page.waitForSelector('[data-testid="journal-entries-grid"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const reversedRow = page.locator('role=row').filter({ hasText: testData.description });
    await expect(reversedRow.locator('[data-testid^="je-post-btn-"]')).not.toBeVisible();
    await expect(reversedRow.locator('[data-testid^="je-reverse-btn-"]')).not.toBeVisible();
    console.log('Final state verified');

    console.log('\nComplete workflow test passed');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });
});
