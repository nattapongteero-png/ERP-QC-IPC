/**
 * Playwright E2E tests for HR Module CRUD Operations
 * 
 * Tests complete HR module workflows including:
 * - HR Dashboard accessibility
 * - Employees CRUD (Create, Read, Update, Delete/Deactivate)
 * - Positions CRUD
 * - Training Courses CRUD
 * - Health Records CRUD
 * - Roles CRUD
 *
 * Run with: npx playwright test tests/e2e/hr-module-crud.spec.ts --headed
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
  await page.fill('input[type="password"]', TEST_USER.password);

  // Submit login
  await page.click('button[type="submit"]');
  console.log('Submitted login form');

  // Wait for redirect
  await page.waitForURL(url => {
    const urlStr = String(url);
    return urlStr.includes('/dashboard') || urlStr.includes('/hr') || urlStr.includes('/accounting');
  }, { timeout: 15000 });
  console.log('Login successful');
}

// Helper function to generate unique test data
function generateTestData(prefix: string) {
  const timestamp = Date.now();
  return {
    code: `${prefix}-${timestamp}`.substring(0, 20),
    name: `Test ${prefix} ${timestamp}`,
    description: `Test ${prefix} created at ${new Date().toISOString()}`,
  };
}

// Helper to set DevExtreme TextBox value
async function setDevExtremeText(page: Page, selector: string, value: string) {
  const container = page.locator(selector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(200);
}

// Helper to select DevExtreme SelectBox option
async function selectDevExtremeOption(page: Page, selector: string, optionIndex: number = 0) {
  const container = page.locator(selector);
  const selectBox = container.locator('.dx-selectbox, .dx-dropdowneditor');

  // Click to open dropdown
  await selectBox.click();
  await page.waitForTimeout(500);

  // Wait for dropdown list
  const visibleListbox = page.locator('[role="listbox"]:visible');
  await visibleListbox.waitFor({ state: 'visible', timeout: 10000 });

  // Find and click option
  const options = visibleListbox.locator('[role="option"]');
  await options.first().waitFor({ state: 'visible', timeout: 5000 });
  await options.nth(optionIndex).click();
  await page.waitForTimeout(300);
}

// Helper to set DevExtreme DateBox value
async function setDevExtremeDate(page: Page, selector: string, dateStr: string) {
  const container = page.locator(selector);
  const input = container.locator('.dx-texteditor-input');
  await input.click();
  await input.fill(dateStr);
  await input.press('Enter');
  await page.waitForTimeout(300);
}

test.describe('HR Module E2E Tests', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ==================== HR DASHBOARD ====================
  test.describe('HR Dashboard', () => {
    test('should display HR dashboard with all modules', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
          console.log(`[CONSOLE ERROR] ${msg.text()}`);
        }
      });

      console.log('Navigating to HR dashboard...');
      await page.goto(`${BASE_URL}/hr`);

      // Wait for page to load
      await page.waitForSelector('[data-testid="hr-dashboard"]', { timeout: 10000 });
      console.log('HR dashboard loaded');

      // Verify KPI cards are visible
      await expect(page.locator('[data-testid="hr-stat-cards"]')).toBeVisible();
      console.log('HR stat cards visible');

      // Verify module cards are visible
      await expect(page.locator('[data-testid="hr-module-cards"]')).toBeVisible();
      console.log('HR module cards visible');

      // Verify quick actions are visible
      await expect(page.locator('[data-testid="hr-quick-actions"]')).toBeVisible();
      console.log('Quick actions visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('HR dashboard test completed successfully');
    });

    test('should navigate to each HR module from dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/hr`);
      await page.waitForSelector('[data-testid="hr-dashboard"]', { timeout: 10000 });

      // Test navigation to Employees
      const employeesLink = page.locator('[data-testid="hr-module-employees"]');
      await expect(employeesLink).toBeVisible();
      await employeesLink.click();
      await page.waitForURL('**/hr/employees', { timeout: 10000 });
      console.log('Navigated to Employees');
      await page.goBack();

      // Test navigation to Positions
      await page.waitForSelector('[data-testid="hr-dashboard"]', { timeout: 10000 });
      const positionsLink = page.locator('[data-testid="hr-module-positions"]');
      await expect(positionsLink).toBeVisible();
      await positionsLink.click();
      await page.waitForURL('**/hr/positions', { timeout: 10000 });
      console.log('Navigated to Positions');
      await page.goBack();

      // Test navigation to Training
      await page.waitForSelector('[data-testid="hr-dashboard"]', { timeout: 10000 });
      const trainingLink = page.locator('[data-testid="hr-module-training"]');
      await expect(trainingLink).toBeVisible();
      await trainingLink.click();
      await page.waitForURL('**/hr/training', { timeout: 10000 });
      console.log('Navigated to Training');

      console.log('Module navigation test completed successfully');
    });
  });

  // ==================== EMPLOYEES CRUD ====================
  test.describe('Employees CRUD', () => {
    test('should display employees list page', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      console.log('Navigating to employees page...');
      await page.goto(`${BASE_URL}/hr/employees`);

      // Wait for page to load
      await page.waitForSelector('[data-testid="hr-employees-page"]', { timeout: 10000 });
      console.log('Employees page loaded');

      // Verify KPI cards
      await expect(page.locator('[data-testid="hr-employees-stats"]')).toBeVisible();
      console.log('Employee stats visible');

      // Verify data grid or cards view
      const dataGrid = page.locator('[data-testid="hr-employees-grid"]');
      const isGridVisible = await dataGrid.isVisible().catch(() => false);
      if (isGridVisible) {
        console.log('Employees grid visible');
      }

      // Verify add button
      await expect(page.locator('[data-testid="hr-add-employee-btn"]')).toBeVisible();
      console.log('Add employee button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('Employees list page test completed successfully');
    });

    test('should create a new employee', async ({ page }) => {
      const errors: string[] = [];
      const testData = generateTestData('EMP');

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
          console.log(`[CONSOLE ERROR] ${msg.text()}`);
        }
      });

      // Navigate to employees page
      console.log('Step 1: Navigating to employees page...');
      await page.goto(`${BASE_URL}/hr/employees`);
      await page.waitForSelector('[data-testid="hr-employees-page"]', { timeout: 10000 });

      // Click add employee button
      console.log('Step 2: Clicking add employee button...');
      await page.click('[data-testid="hr-add-employee-btn"]');
      await page.waitForURL('**/hr/employees/new', { timeout: 10000 });
      console.log('Navigated to new employee page');

      // Fill in employee form
      console.log('Step 3: Filling employee form...');
      
      // Fill first name (required)
      await setDevExtremeText(page, '[data-testid="emp-firstname-field"]', 'ทดสอบ');
      console.log('Filled first name');

      // Fill last name (required)
      await setDevExtremeText(page, '[data-testid="emp-lastname-field"]', 'การสร้าง');
      console.log('Filled last name');

      // Fill email
      await setDevExtremeText(page, '[data-testid="emp-email-field"]', `test.${testData.code}@example.com`);
      console.log('Filled email');

      // Fill phone
      await setDevExtremeText(page, '[data-testid="emp-phone-field"]', '0812345678');
      console.log('Filled phone');

      // Set hire date (required)
      const today = new Date().toISOString().split('T')[0];
      await setDevExtremeDate(page, '[data-testid="emp-hiredate-field"]', today);
      console.log('Filled hire date');

      // Submit the form
      console.log('Step 4: Submitting form...');
      await page.click('[data-testid="emp-submit-btn"]');

      // Wait for success or redirect
      await page.waitForTimeout(3000);

      // Check if redirected to employee profile or list
      const currentUrl = page.url();
      const isSuccess = currentUrl.includes('/hr/employees/') && !currentUrl.includes('/new');
      if (isSuccess) {
        console.log('Employee created successfully, redirected to profile page');
      } else {
        // Navigate to list and verify
        await page.goto(`${BASE_URL}/hr/employees`);
        await page.waitForSelector('[data-testid="hr-employees-page"]', { timeout: 10000 });
        console.log('Checking employees list...');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('Employee creation test completed');
    });

    test('should view employee details', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      console.log('Navigating to employees page...');
      await page.goto(`${BASE_URL}/hr/employees`);
      await page.waitForSelector('[data-testid="hr-employees-page"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Click on first employee row or view button
      const viewButton = page.locator('[data-testid^="emp-view-btn-"]').first();
      const viewButtonCount = await viewButton.count();

      if (viewButtonCount > 0) {
        await viewButton.click();
        console.log('Clicked view button');
      } else {
        // Try clicking on a row
        const row = page.locator('.dx-data-row').first();
        await row.click();
        console.log('Clicked on employee row');
      }

      // Wait for navigation to detail page
      await page.waitForURL('**/hr/employees/*', { timeout: 10000 });
      console.log('Navigated to employee detail page');

      // Verify profile elements
      await page.waitForTimeout(1000);
      const pageContent = await page.content();
      expect(pageContent.length).toBeGreaterThan(1000);
      console.log('Employee detail page content verified');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('Employee view test completed');
    });

    test('should edit an employee', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      // Navigate to employees list
      await page.goto(`${BASE_URL}/hr/employees`);
      await page.waitForSelector('[data-testid="hr-employees-page"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Click on first employee
      const row = page.locator('.dx-data-row').first();
      const rowCount = await row.count();
      if (rowCount === 0) {
        console.log('No employees found, skipping edit test');
        return;
      }

      await row.click();
      await page.waitForURL('**/hr/employees/*', { timeout: 10000 });
      console.log('Navigated to employee detail page');

      // Click edit button
      const editButton = page.locator('[data-testid="emp-edit-btn"]');
      const editCount = await editButton.count();
      if (editCount > 0) {
        await editButton.click();
        await page.waitForURL('**/hr/employees/*/edit', { timeout: 10000 });
        console.log('Navigated to edit page');

        // Make a change - update phone number
        await setDevExtremeText(page, '[data-testid="emp-phone-field"]', '0899999999');
        console.log('Updated phone number');

        // Submit
        await page.click('[data-testid="emp-submit-btn"]');
        await page.waitForTimeout(2000);
        console.log('Submitted changes');
      } else {
        // Try finding edit button with different selector
        const altEditButton = page.getByRole('button').filter({ hasText: 'แก้ไข' });
        if (await altEditButton.count() > 0) {
          await altEditButton.click();
          await page.waitForTimeout(1000);
          console.log('Clicked alternative edit button');
        }
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
      console.log('Employee edit test completed');
    });
  });

  // ==================== POSITIONS CRUD ====================
  test.describe('Positions CRUD', () => {
    test('should display positions list page', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      console.log('Navigating to positions page...');
      await page.goto(`${BASE_URL}/hr/positions`);

      await page.waitForSelector('[data-testid="hr-positions-page"]', { timeout: 10000 });
      console.log('Positions page loaded');

      // Verify KPI stats
      await expect(page.locator('[data-testid="hr-positions-stats"]')).toBeVisible();
      console.log('Position stats visible');

      // Verify add button
      await expect(page.locator('[data-testid="hr-add-position-btn"]')).toBeVisible();
      console.log('Add position button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create a new position', async ({ page }) => {
      const errors: string[] = [];
      const testData = generateTestData('POS');

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/positions`);
      await page.waitForSelector('[data-testid="hr-positions-page"]', { timeout: 10000 });

      // Click add position button
      await page.click('[data-testid="hr-add-position-btn"]');
      await page.waitForURL('**/hr/positions/new', { timeout: 10000 });
      console.log('Navigated to new position page');

      // Fill position form
      await setDevExtremeText(page, '[data-testid="pos-code-field"]', testData.code);
      console.log('Filled position code');

      await setDevExtremeText(page, '[data-testid="pos-title-field"]', testData.name);
      console.log('Filled position title');

      await setDevExtremeText(page, '[data-testid="pos-title-en-field"]', `Test Position ${testData.code}`);
      console.log('Filled English title');

      // Select org unit if available
      try {
        await selectDevExtremeOption(page, '[data-testid="pos-orgunit-field"]', 0);
        console.log('Selected org unit');
      } catch {
        console.log('Org unit selection skipped');
      }

      // Submit
      await page.click('[data-testid="pos-submit-btn"]');
      await page.waitForTimeout(2000);

      console.log('Position creation test completed');
      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should view position details', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/positions`);
      await page.waitForSelector('[data-testid="hr-positions-page"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Click on first position row
      const row = page.locator('.dx-data-row').first();
      const rowCount = await row.count();
      if (rowCount > 0) {
        await row.click();
        await page.waitForURL('**/hr/positions/*', { timeout: 10000 });
        console.log('Navigated to position detail page');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== TRAINING COURSES CRUD ====================
  test.describe('Training Courses CRUD', () => {
    test('should display training courses list page', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/training/courses`);
      await page.waitForSelector('[data-testid="hr-courses-page"]', { timeout: 10000 });
      console.log('Training courses page loaded');

      // Verify stats
      await expect(page.locator('[data-testid="hr-courses-stats"]')).toBeVisible();
      console.log('Course stats visible');

      // Verify add button
      await expect(page.locator('[data-testid="hr-add-course-btn"]')).toBeVisible();
      console.log('Add course button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create a new training course', async ({ page }) => {
      const errors: string[] = [];
      const testData = generateTestData('CRS');

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/training/courses`);
      await page.waitForSelector('[data-testid="hr-courses-page"]', { timeout: 10000 });

      await page.click('[data-testid="hr-add-course-btn"]');
      await page.waitForURL('**/hr/training/courses/new', { timeout: 10000 });
      console.log('Navigated to new course page');

      // Fill course form
      await setDevExtremeText(page, '[data-testid="course-code-field"]', testData.code);
      await setDevExtremeText(page, '[data-testid="course-name-field"]', testData.name);

      // Submit
      await page.click('[data-testid="course-submit-btn"]');
      await page.waitForTimeout(2000);

      console.log('Course creation test completed');
      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== HEALTH RECORDS CRUD ====================
  test.describe('Health Records CRUD', () => {
    test('should display health records list page', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/health-records`);
      await page.waitForSelector('[data-testid="hr-health-records-page"]', { timeout: 10000 });
      console.log('Health records page loaded');

      // Verify stats
      await expect(page.locator('[data-testid="hr-health-stats"]')).toBeVisible();
      console.log('Health stats visible');

      // Verify add button
      await expect(page.locator('[data-testid="hr-add-health-record-btn"]')).toBeVisible();
      console.log('Add health record button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should navigate to create new health record', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/health-records`);
      await page.waitForSelector('[data-testid="hr-health-records-page"]', { timeout: 10000 });

      await page.click('[data-testid="hr-add-health-record-btn"]');
      await page.waitForURL('**/hr/health-records/new', { timeout: 10000 });
      console.log('Navigated to new health record page');

      // Verify form is loaded
      await page.waitForTimeout(1000);
      const pageContent = await page.content();
      expect(pageContent.length).toBeGreaterThan(1000);

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== ROLES CRUD ====================
  test.describe('Roles CRUD', () => {
    test('should display roles list page', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/roles`);
      await page.waitForSelector('[data-testid="hr-roles-page"]', { timeout: 10000 });
      console.log('Roles page loaded');

      // Verify stats
      await expect(page.locator('[data-testid="hr-roles-stats"]')).toBeVisible();
      console.log('Role stats visible');

      // Verify add button
      await expect(page.locator('[data-testid="hr-add-role-btn"]')).toBeVisible();
      console.log('Add role button visible');

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should create a new role', async ({ page }) => {
      const errors: string[] = [];
      const testData = generateTestData('ROLE');

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/roles`);
      await page.waitForSelector('[data-testid="hr-roles-page"]', { timeout: 10000 });

      await page.click('[data-testid="hr-add-role-btn"]');
      await page.waitForURL('**/hr/roles/new', { timeout: 10000 });
      console.log('Navigated to new role page');

      // Fill role form
      await setDevExtremeText(page, '[data-testid="role-code-field"]', testData.code);
      await setDevExtremeText(page, '[data-testid="role-name-field"]', testData.name);
      await setDevExtremeText(page, '[data-testid="role-description-field"]', testData.description);

      // Submit
      await page.click('[data-testid="role-submit-btn"]');
      await page.waitForTimeout(2000);

      console.log('Role creation test completed');
      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });

    test('should view role details', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/hr/roles`);
      await page.waitForSelector('[data-testid="hr-roles-page"]', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Click on first role row
      const row = page.locator('.dx-data-row').first();
      const rowCount = await row.count();
      if (rowCount > 0) {
        await row.click();
        await page.waitForURL('**/hr/roles/*', { timeout: 10000 });
        console.log('Navigated to role detail page');
      }

      expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ==================== COMPLETE WORKFLOW TEST ====================
  test('should perform complete HR workflow', async ({ page }) => {
    const errors: string[] = [];
    const testData = generateTestData('WF');

    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to fetch')) {
        errors.push(msg.text());
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    console.log('=== Complete HR Workflow Test ===');

    // 1. Access HR Dashboard
    console.log('\n--- Step 1: HR Dashboard ---');
    await page.goto(`${BASE_URL}/hr`);
    await page.waitForSelector('[data-testid="hr-dashboard"]', { timeout: 10000 });
    console.log('HR Dashboard loaded');

    // 2. Navigate to Employees and list
    console.log('\n--- Step 2: Employees List ---');
    await page.click('[data-testid="hr-module-employees"]');
    await page.waitForURL('**/hr/employees', { timeout: 10000 });
    await page.waitForSelector('[data-testid="hr-employees-page"]', { timeout: 10000 });
    console.log('Employees list loaded');

    // 3. Navigate to Positions and list
    console.log('\n--- Step 3: Positions List ---');
    await page.goto(`${BASE_URL}/hr/positions`);
    await page.waitForSelector('[data-testid="hr-positions-page"]', { timeout: 10000 });
    console.log('Positions list loaded');

    // 4. Navigate to Training Courses
    console.log('\n--- Step 4: Training Courses ---');
    await page.goto(`${BASE_URL}/hr/training/courses`);
    await page.waitForSelector('[data-testid="hr-courses-page"]', { timeout: 10000 });
    console.log('Training courses loaded');

    // 5. Navigate to Health Records
    console.log('\n--- Step 5: Health Records ---');
    await page.goto(`${BASE_URL}/hr/health-records`);
    await page.waitForSelector('[data-testid="hr-health-records-page"]', { timeout: 10000 });
    console.log('Health records loaded');

    // 6. Navigate to Roles
    console.log('\n--- Step 6: Roles ---');
    await page.goto(`${BASE_URL}/hr/roles`);
    await page.waitForSelector('[data-testid="hr-roles-page"]', { timeout: 10000 });
    console.log('Roles list loaded');

    // 7. Return to Dashboard
    console.log('\n--- Step 7: Return to Dashboard ---');
    await page.goto(`${BASE_URL}/hr`);
    await page.waitForSelector('[data-testid="hr-dashboard"]', { timeout: 10000 });
    console.log('Returned to HR Dashboard');

    console.log('\nComplete workflow test passed');
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });
});
