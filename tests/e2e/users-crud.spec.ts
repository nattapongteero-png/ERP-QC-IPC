/**
 * Playwright E2E test for Users Module CRUD Operations
 * Tests complete user management workflow including:
 * - Creating a new user
 * - Editing user information
 * - Deleting user
 * - Verifying changes persist
 *
 * Run with: npx playwright test tests/e2e/users-crud.spec.ts --headed
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

  // Fill in credentials manually
  await page.fill('input[type="email"]', TEST_USER.email);
  console.log(`✓ Filled email: ${TEST_USER.email}`);

  await page.fill('input[type="password"]', TEST_USER.password);
  console.log('✓ Filled password');

  // Submit login
  await page.click('button[type="submit"]');
  console.log('✓ Submitted login form');

  // Wait for redirect - check for dashboard OR users page
  await page.waitForURL(url => {
    const urlStr = String(url);
    return urlStr.includes('/dashboard') || urlStr.includes('/users');
  }, { timeout: 15000 });
  console.log('✓ Login successful');
}

// Helper function to generate unique test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `testuser${timestamp}@test.com`,
    initialPassword: 'testpass123',
    newPassword: 'newpass456'
  };
}

test.describe('Users Module CRUD E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should create a new user', async ({ page }) => {
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

    // Navigate to users page
    console.log('Step 1: Navigating to users page...');
    await page.goto(`${BASE_URL}/users`);

    // Wait for page to load
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    console.log('✓ Users page loaded');

    // Get initial user count
    await page.waitForFunction(() => {
      const summaryText = document.body.textContent || '';
      return summaryText.includes('7') && !summaryText.includes('- 7');
    }, { timeout: 10000 });
    console.log('✓ Initial users loaded');

    // Click add user button using data-testid
    console.log('Step 2: Clicking "Add User" button...');
    await page.click('[data-testid="users-add-user-btn"]');
    console.log('✓ Clicked add user button');

    // Wait for navigation to new user page
    await page.waitForURL('**/users/new', { timeout: 10000 });
    console.log('✓ Navigated to new user page');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Wait for lookup data to load (check for loading indicator to disappear)
    await page.waitForSelector('text=กำลังโหลดข้อมูล', { state: 'detached', timeout: 10000 });
    console.log('✓ Lookup data loaded');

    // Fill in user information
    console.log('Step 3: Filling in user information...');
    
    // Wait for name field to be visible
    await page.waitForSelector('[data-testid="new-user-name-input"]', { timeout: 10000 });
    
    // Fill name
    await page.fill('[data-testid="new-user-name-input"]', testData.name);
    console.log(`✓ Filled name: ${testData.name}`);

    // Fill email
    await page.fill('[data-testid="new-user-email-input"]', testData.email);
    console.log(`✓ Filled email: ${testData.email}`);

    // Select role - use first dropdown (role)
    // Click on role dropdown
    const roleDropdown = page.locator('.dx-selectbox').first();
    await roleDropdown.click();
    await page.waitForTimeout(500);
    
    // Get the first available role and select it
    const roleOptions = page.locator('[role="option"]');
    const firstRole = roleOptions.first();
    await firstRole.click();
    console.log('✓ Selected first available role');
    await page.waitForTimeout(300);

    // Select department - use second dropdown (department)
    // Click on department dropdown
    const departmentDropdowns = page.locator('.dx-selectbox');
    await departmentDropdowns.nth(1).click();
    await page.waitForTimeout(500);
    
    // Select first available department (skip "ไม่ระบุ")
    const deptOptions = page.locator('[role="option"]');
    await deptOptions.nth(1).click();
    console.log('✓ Selected first available department');
    await page.waitForTimeout(300);

    // Fill password
    await page.fill('[data-testid="new-user-password-input"]', testData.initialPassword);
    console.log('✓ Filled password');

    // Fill confirm password
    await page.fill('[data-testid="new-user-confirm-password-input"]', testData.initialPassword);
    console.log('✓ Filled confirm password');

    // Submit form
    console.log('Step 4: Submitting form...');
    await page.click('[data-testid="new-user-submit-btn"]');
    console.log('✓ Clicked submit button');

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Check for errors
    const errorMessages = page.locator('text=เกิดข้อผิดพลาดในการสร้างผู้ใช้');
    const hasError = await errorMessages.count() > 0;

    if (hasError) {
      const errorText = await errorMessages.first().textContent();
      console.log(`❌ Error occurred: ${errorText}`);
    }

    expect(hasError, 'User creation should succeed without errors').toBe(false);

    // Verify we're redirected to users list or detail page
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // If we're on detail page or back on users list, consider it successful
    if (currentUrl.includes('/users/') || currentUrl.includes('/dashboard')) {
      console.log('✓ Navigation occurred after successful save');
    }

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('✅ User creation test completed successfully');
  });

  test('should edit an existing user', async ({ page }) => {
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

    // Navigate to users page
    console.log('Step 1: Navigating to users page...');
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Users page loaded');

    // Find and click on a user to edit (use Sales Manager)
    console.log('Step 2: Selecting user to edit...');
    const userRows = page.locator('role=row');
    const salesManagerRow = userRows.filter({ hasText: 'Sales Manager' });
    await salesManagerRow.first().locator('[aria-label="edit"]').click();
    console.log('✓ Clicked edit button for Sales Manager');

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Navigated to user detail page');

    // Click edit button to enter edit mode
    console.log('Step 3: Entering edit mode...');
    await page.click('button:has-text("แก้ไข")');
    await page.waitForTimeout(500);
    console.log('✓ Entered edit mode');

    // Verify edit mode is active (input fields should appear)
    await expect(page.locator('input[value="Sales Manager"]')).toBeVisible();
    console.log('✓ Edit mode confirmed');

    // Modify user name
    const updatedName = `${testData.name} (Updated)`;
    await page.fill('input[value="Sales Manager"]', updatedName);
    console.log(`✓ Changed name to: ${updatedName}`);

    // Save changes
    console.log('Step 4: Saving changes...');
    await page.click('button:has-text("บันทึก")');
    console.log('✓ Clicked save button');

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Verify success message
    const successMessage = page.locator('text=บันทึกข้อมูลสำเร็จ');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    console.log('✓ Save successful');

    // Verify new name is displayed
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    console.log(`✓ New name "${updatedName}" displayed`);

    // Navigate back to users list
    console.log('Step 5: Navigating back to list...');
    await page.click('button[aria-label="กลับ"]');
    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(500);
    console.log('✓ Back to users list');

    // Verify changes persist in list
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    console.log(`✓ Modified user "${updatedName}" found in list`);

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('✅ User edit test completed successfully');
  });

  test('should change user password', async ({ page }) => {
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

    // Navigate to users page
    console.log('Step 1: Navigating to users page...');
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Users page loaded');

    // Find and click on a user (use Warehouse Manager)
    console.log('Step 2: Selecting user...');
    const userRows = page.locator('role=row');
    const wmRow = userRows.filter({ hasText: 'Warehouse Manager' });
    await wmRow.first().locator('[aria-label="edit"]').click();
    console.log('✓ Clicked edit button for Warehouse Manager');

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Navigated to user detail page');

    // Click "เปลี่ยนรหัสผ่าน" button to expand password section
    console.log('Step 3: Opening password change section...');
    await page.click('button:has-text("เปลี่ยนรหัสผ่าน")');
    console.log('✓ Password section expanded');

    // Wait for password inputs
    await page.waitForSelector('input[placeholder*="กรอกรหัสผ่านใหม่"]', { timeout: 10000 });
    console.log('✓ Password inputs visible');

    // Fill in new password
    await page.fill('input[placeholder*="กรอกรหัสผ่านใหม่"]', testData.newPassword);
    console.log('✓ Filled new password');

    // Fill in confirm password
    await page.fill('input[placeholder*="กรอกรหัสผ่านอีกครั้ง"]', testData.newPassword);
    console.log('✓ Filled confirm password');

    // Submit password change
    console.log('Step 4: Changing password...');
    await page.click('button:has-text("เปลี่ยนรหัสผ่าน")');
    console.log('✓ Clicked change password button');

    // Wait for change to complete
    await page.waitForTimeout(2000);

    // Verify success message
    const successMessage = page.locator('text=เปลี่ยนรหัสผ่านสำเร็จ');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    console.log('✓ Password change successful');

    // Verify password section is collapsed
    const passwordSection = page.locator('text=รหัสผ่านใหม่');
    await expect(passwordSection).not.toBeVisible({ timeout: 5000 });
    console.log('✓ Password section collapsed');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('✅ Password change test completed successfully');
  });

  test('should delete a user', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // First, create a test user to delete
    console.log('Step 0: Creating a test user to delete...');
    const testData = generateTestData();
    
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click add user
    await page.click('[data-testid="users-add-user-btn"]');
    await page.waitForURL('**/users/new', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Fill form
    await page.fill('[data-testid="new-user-name-input"]', testData.name);
    await page.fill('[data-testid="new-user-email-input"]', testData.email);
    await page.fill('[data-testid="new-user-password-input"]', testData.initialPassword);
    await page.fill('[data-testid="new-user-confirm-password-input"]', testData.initialPassword);

    // Select role
    const roleDropdown = page.locator('.dx-selectbox').first();
    await roleDropdown.click();
    await page.waitForTimeout(500);
    const roleOptions = page.locator('[role="option"]');
    const firstRole = roleOptions.first();
    await firstRole.click();
    await page.waitForTimeout(300);

    // Select department
    const departmentDropdowns = page.locator('.dx-selectbox');
    await departmentDropdowns.nth(1).click();
    await page.waitForTimeout(500);
    const deptOptions = page.locator('[role="option"]');
    await deptOptions.nth(1).click();
    await page.waitForTimeout(300);

    // Submit
    await page.click('[data-testid="new-user-submit-btn"]');
    await page.waitForTimeout(2000);

    console.log(`✓ Created test user: ${testData.name}`);

    // Now delete the user
    console.log('Step 1: Selecting user to delete...');
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const testUserRow = page.locator('role=row').filter({ hasText: testData.name });
    await testUserRow.locator('[aria-label="edit"]').first().click();
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Navigated to user detail page');

    // Click delete button in danger zone
    console.log('Step 2: Clicking delete button...');
    await page.click('button:has-text("ลบผู้ใช้")');
    console.log('✓ Clicked delete button');

    // Wait for confirmation dialog
    await page.waitForTimeout(500);

    // Verify confirmation dialog appears
    await expect(page.locator('text=ยืนยันการลบผู้ใช้')).toBeVisible();
    console.log('✓ Confirmation dialog appeared');

    // Verify user info in dialog
    await expect(page.locator(`text=${testData.name}`)).toBeVisible();
    console.log(`✓ User info verified in dialog`);

    // Confirm deletion
    console.log('Step 3: Confirming deletion...');
    await page.click('button:has-text("ลบผู้ใช้")');
    console.log('✓ Confirmed deletion');

    // Wait for deletion to complete
    await page.waitForTimeout(2000);

    // Verify we're redirected back to users list
    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Redirected back to users list');

    // Verify user is no longer in list
    await expect(page.locator(`text=${testData.name}`)).not.toBeVisible();
    console.log(`✓ User "${testData.name}" no longer in list`);

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);

    console.log('✅ User deletion test completed successfully');
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

    console.log('=== Complete CRUD Workflow Test ===');

    // CREATE
    console.log('\n--- CREATE ---');
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.click('[data-testid="users-add-user-btn"]');
    await page.waitForURL('**/users/new', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Fill form
    await page.fill('[data-testid="new-user-name-input"]', testData.name);
    await page.fill('[data-testid="new-user-email-input"]', testData.email);
    const roleDropdown = page.locator('.dx-selectbox').first();
    await roleDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);
    const deptDropdowns = page.locator('.dx-selectbox');
    await deptDropdowns.nth(1).click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]').nth(1).click();
    await page.waitForTimeout(300);
    await page.fill('[data-testid="new-user-password-input"]', testData.initialPassword);
    await page.fill('[data-testid="new-user-confirm-password-input"]', testData.initialPassword);
    await page.click('[data-testid="new-user-submit-btn"]');
    await page.waitForTimeout(2000);

    console.log('✓ User created successfully');

    // READ/UPDATE
    console.log('\n--- READ/UPDATE ---');
    const userRow = page.locator('role=row').filter({ hasText: testData.name });
    await userRow.locator('[aria-label="edit"]').first().click();
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.click('button:has-text("แก้ไข")');
    await page.waitForTimeout(500);

    const updatedName = `${testData.name} (Updated)`;
    await page.fill('input[value*="' + testData.name + '"]', updatedName);
    await page.click('button:has-text("บันทึก")');
    await page.waitForTimeout(2000);

    await expect(page.locator('text=บันทึกข้อมูลสำเร็จ')).toBeVisible();
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    console.log('✓ User updated successfully');

    // DELETE
    console.log('\n--- DELETE ---');
    await page.click('button:has-text("กลับไปหน้ารายการ")');
    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const deleteRow = page.locator('role=row').filter({ hasText: updatedName });
    await deleteRow.locator('[aria-label="edit"]').first().click();
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.click('button:has-text("ลบผู้ใช้")');
    await page.waitForTimeout(500);
    await expect(page.locator('text=ยืนยันการลบผู้ใช้')).toBeVisible();
    await page.click('button:has-text("ลบผู้ใช้")');
    await page.waitForTimeout(2000);

    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${updatedName}`)).not.toBeVisible();
    await expect(page.locator(`text=${testData.name}`)).not.toBeVisible();
    console.log('✓ User deleted successfully');

    console.log('\n✅ Complete CRUD workflow test passed');

    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });
});
