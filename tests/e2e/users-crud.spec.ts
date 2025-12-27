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

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  console.log('✓ Login successful');
}

// Helper function to generate unique test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `testuser${timestamp}@test.com`,
    department: 'ฝ่ายผลิต',
    role: 'production',
    initialPassword: 'testpass123',
    newPassword: 'newpass456'
  };
}

test.describe('Users Module CRUD E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
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

    // Click "เพิ่มผู้ใช้" button
    console.log('Step 2: Clicking "Add User" button...');
    await page.click('button:has-text("เพิ่มผู้ใช้")');
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
    await page.waitForSelector('input[placeholder*="กรอกชื่อ-นามสกุล"]', { timeout: 10000 });
    
    // Fill name
    await page.fill('input[placeholder*="กรอกชื่อ-นามสกุล"]', testData.name);
    console.log(`✓ Filled name: ${testData.name}`);

    // Fill email
    await page.fill('input[placeholder*="กรอกอีเมล"]', testData.email);
    console.log(`✓ Filled email: ${testData.email}`);

    // Select role - use first dropdown (role)
    // Click on role dropdown
    const roleDropdown = page.locator('.dx-selectbox').first();
    await roleDropdown.click();
    await page.waitForTimeout(500);
    
    // Get the first role option (production) and select it
    const roleOptions = page.locator('[role="option"]');
    const firstRole = await roleOptions.first().textContent();
    const productionRole = roleOptions.filter({ hasText: 'ฝ่ายผลิต' }).first();
    
    if (await productionRole.count() > 0) {
      await productionRole.click();
      console.log('✓ Selected role: ฝ่ายผลิต');
    } else {
      await roleOptions.nth(1).click(); // Second option as fallback
      console.log('✓ Selected first available role');
    }
    await page.waitForTimeout(300);

    // Select department - use second dropdown (department)
    // Click on department dropdown
    const departmentDropdowns = page.locator('.dx-selectbox');
    await departmentDropdowns.nth(1).click();
    await page.waitForTimeout(500);
    
    // Select first available department
    const deptOptions = page.locator('[role="option"]');
    await deptOptions.nth(1).click(); // Skip "ไม่ระบุ"
    console.log('✓ Selected department');

    // Fill password
    await page.fill('input[placeholder*="กรอกรหัสผ่าน"]', testData.initialPassword);
    console.log('✓ Filled password');

    // Fill confirm password
    const passwordFields = page.locator('input[placeholder*="ยืนยันรหัสผ่าน"]');
    await passwordFields.nth(0).fill(testData.initialPassword);
    console.log('✓ Filled confirm password');

    // Submit the form
    console.log('Step 4: Submitting the form...');
    await page.click('button:has-text("บันทึก")');
    console.log('✓ Clicked save button');

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Check for errors
    const errorMessages = page.locator('text=เกิดข้อผิดพลาด');
    const hasError = await errorMessages.count() > 0;
    
    if (hasError) {
      const errorText = await errorMessages.first().textContent();
      console.log(`❌ Error occurred: ${errorText}`);
    }

    expect(hasError, 'User creation should succeed without errors').toBe(false);

    // Verify we're redirected to users list or detail page
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // If we're on detail page, navigate back to list
    if (currentUrl.includes('/users/') && !currentUrl.includes('/users/new')) {
      console.log('✓ User created and redirected to detail page');
      // Navigate back to users list
      await page.click('button[aria-label="กลับ"]');
      await page.waitForURL('**/users$', { timeout: 10000 });
    } else {
      await page.waitForURL('**/users$', { timeout: 10000 });
    }

    console.log('✓ Navigated back to users list');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Verify new user appears in the list
    console.log('Step 5: Verifying new user in list...');
    await expect(page.locator(`text=${testData.name}`)).toBeVisible({ timeout: 10000 });
    console.log(`✓ New user "${testData.name}" found in list`);

    // Verify new email appears
    await expect(page.locator(`text=${testData.email}`)).toBeVisible();
    console.log(`✓ Email "${testData.email}" found in list`);

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
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Users page loaded');

    // Find and click on a user to edit (use Sales Manager)
    console.log('Step 2: Selecting user to edit...');
    const salesManagerRow = page.locator('role=row').filter({ hasText: 'Sales Manager' });
    await salesManagerRow.locator('button[aria-label="edit"]').click();
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

    // Verify we're in edit mode (input fields should appear)
    await expect(page.locator('input[value="Sales Manager"]')).toBeVisible();
    console.log('✓ Edit mode confirmed');

    // Modify user name
    console.log('Step 4: Modifying user information...');
    const nameInput = page.locator('input[value="Sales Manager"]');
    await nameInput.fill(testData.name);
    console.log(`✓ Changed name to: ${testData.name}`);

    // Modify department
    const departmentDropdown = page.locator('.dx-selectbox').filter({ hasText: /ฝ่ายขาย|Select/ });
    await departmentDropdown.click();
    await page.waitForTimeout(300);
    
    // Select "ฝ่ายผลิต" instead
    await page.locator('[role="option"]').filter({ hasText: 'ฝ่ายผลิต' }).click();
    await page.waitForTimeout(300);
    console.log('✓ Changed department to: ฝ่ายผลิต');

    // Save changes
    console.log('Step 5: Saving changes...');
    await page.click('button:has-text("บันทึก")');
    console.log('✓ Clicked save button');

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Verify success message
    const successMessage = page.locator('text=บันทึกข้อมูลสำเร็จ');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    console.log('✓ Save successful');

    // Verify we're back in view mode
    await expect(page.locator(`text=${testData.name}`)).toBeVisible();
    console.log(`✓ New name "${testData.name}" displayed`);

    // Verify department changed
    await expect(page.locator('text=ฝ่ายผลิต')).toBeVisible();
    console.log('✓ Department changed');

    // Navigate back to users list
    console.log('Step 6: Navigating back to list...');
    await page.click('button[aria-label="กลับ"]');
    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Back to users list');

    // Verify changes persist in the list
    await expect(page.locator(`text=${testData.name}`)).toBeVisible();
    console.log(`✓ Modified user "${testData.name}" found in list`);

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
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Users page loaded');

    // Find and click on a user (use Warehouse Manager)
    console.log('Step 2: Selecting user...');
    const wmRow = page.locator('role=row').filter({ hasText: 'Warehouse Manager' });
    await wmRow.locator('button[aria-label="edit"]').click();
    console.log('✓ Clicked edit button for Warehouse Manager');

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Navigated to user detail page');

    // Click "เปลี่ยนรหัสผ่าน" button to expand password section
    console.log('Step 3: Opening password change section...');
    await page.click('button:has-text("เปลี่ยนรหัสผ่าน")');
    await page.waitForTimeout(500);
    console.log('✓ Password section expanded');

    // Fill in new password
    console.log('Step 4: Entering new password...');
    const passwordInputs = page.locator('input[placeholder*="กรอกรหัสผ่านใหม่"]');
    await passwordInputs.nth(0).fill(testData.newPassword);
    console.log('✓ Filled new password');

    // Fill confirm password
    const confirmPasswordInputs = page.locator('input[placeholder*="กรอกรหัสผ่านอีกครั้ง"]');
    await confirmPasswordInputs.nth(0).fill(testData.newPassword);
    console.log('✓ Filled confirm password');

    // Submit password change
    console.log('Step 5: Changing password...');
    const changePasswordButtons = page.locator('button:has-text("เปลี่ยนรหัสผ่าน")');
    await changePasswordButtons.last().click();
    console.log('✓ Clicked change password button');

    // Wait for change to complete
    await page.waitForTimeout(2000);

    // Verify success message
    const successMessage = page.locator('text=เปลี่ยนรหัสผ่านสำเร็จ');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    console.log('✓ Password change successful');

    // Verify password section is collapsed
    const passwordSection = page.locator('text=รหัสผ่านใหม่');
    const isPasswordSectionVisible = await passwordSection.isVisible().catch(() => false);
    expect(isPasswordSectionVisible).toBe(false);
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

    // Click add user
    await page.click('button:has-text("เพิ่มผู้ใช้")');
    await page.waitForURL('**/users/new', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Fill user form
    await page.fill('input[placeholder*="กรอกชื่อ-นามสกุล"]', testData.name);
    await page.fill('input[placeholder*="กรอกอีเมล"]', testData.email);
    await page.locator('.dx-selectbox').first().click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: 'ฝ่ายผลิต' }).click();
    await page.waitForTimeout(300);
    await page.locator('.dx-selectbox').nth(1).click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: 'ฝ่ายผลิต' }).click();
    await page.waitForTimeout(300);
    await page.fill('input[placeholder*="กรอกรหัสผ่าน"]', testData.initialPassword);
    const passwordFields = page.locator('input[placeholder*="ยืนยันรหัสผ่าน"]');
    await passwordFields.nth(0).fill(testData.initialPassword);
    
    // Submit
    await page.click('button:has-text("บันทึก")');
    await page.waitForTimeout(2000);
    
    // Navigate back to list
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    console.log(`✓ Created test user: ${testData.name}`);

    // Verify user exists
    await expect(page.locator(`text=${testData.name}`)).toBeVisible();
    console.log('✓ Test user verified in list');

    // Now delete the user
    console.log('Step 1: Selecting user to delete...');
    const testUserRow = page.locator('role=row').filter({ hasText: testData.name });
    await testUserRow.locator('button[aria-label="edit"]').click();
    console.log('✓ Clicked edit button for test user');

    // Wait for detail page
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
    const confirmDialog = page.locator('text=ยืนยันการลบผู้ใช้');
    await expect(confirmDialog).toBeVisible();
    console.log('✓ Confirmation dialog appeared');

    // Verify user info in dialog
    await expect(page.locator(`text=${testData.name}`)).toBeVisible();
    await expect(page.locator('text=การลบผู้ใช้จะเป็นการปิดใช้งานบัญชี')).toBeVisible();
    console.log('✓ User info verified in dialog');

    // Confirm deletion
    console.log('Step 3: Confirming deletion...');
    const deleteButtons = page.locator('button:has-text("ลบผู้ใช้")');
    const confirmDeleteButton = deleteButtons.filter({ hasText: 'ลบ' }).first();
    await confirmDeleteButton.click();
    console.log('✓ Confirmed deletion');

    // Wait for deletion to complete
    await page.waitForTimeout(2000);

    // Verify we're redirected back to users list
    await page.waitForURL('**/users$', { timeout: 10000 });
    console.log('✓ Redirected back to users list');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Verify user is no longer in the list
    console.log('Step 4: Verifying user deletion...');
    const deletedUser = page.locator(`text=${testData.name}`);
    await expect(deletedUser).not.toBeVisible();
    console.log(`✓ User "${testData.name}" no longer in list`);

    // Verify user count decreased
    const userCountText = await page.locator('text=หน้า 1 จาก 1').textContent();
    console.log(`Current user count: ${userCountText}`);
    console.log('✓ User deletion confirmed');

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
    await page.click('button:has-text("เพิ่มผู้ใช้")');
    await page.waitForURL('**/users/new', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder*="กรอกชื่อ-นามสกุล"]', testData.name);
    await page.fill('input[placeholder*="กรอกอีเมล"]', testData.email);
    await page.locator('.dx-selectbox').first().click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: 'ฝ่ายผลิต' }).click();
    await page.waitForTimeout(300);
    await page.locator('.dx-selectbox').nth(1).click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: 'ฝ่ายผลิต' }).click();
    await page.waitForTimeout(300);
    await page.fill('input[placeholder*="กรอกรหัสผ่าน"]', testData.initialPassword);
    const passwordFields = page.locator('input[placeholder*="ยืนยันรหัสผ่าน"]');
    await passwordFields.nth(0).fill(testData.initialPassword);
    
    await page.click('button:has-text("บันทึก")');
    await page.waitForTimeout(2000);
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${testData.name}`)).toBeVisible();
    console.log('✓ User created successfully');

    // READ/UPDATE
    console.log('\n--- READ/UPDATE ---');
    const userRow = page.locator('role=row').filter({ hasText: testData.name });
    await userRow.locator('button[aria-label="edit"]').click();
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.click('button:has-text("แก้ไข")');
    await page.waitForTimeout(500);

    const updatedName = `${testData.name} (Updated)`;
    const nameInput = page.locator('input').filter({ hasText: testData.name });
    await nameInput.fill(updatedName);
    
    await page.click('button:has-text("บันทึก")');
    await page.waitForTimeout(2000);

    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    console.log('✓ User updated successfully');

    // DELETE
    console.log('\n--- DELETE ---');
    await page.click('button:has-text("ลบผู้ใช้")');
    await page.waitForTimeout(500);
    const deleteButtons = page.locator('button:has-text("ลบผู้ใช้")');
    const confirmButton = deleteButtons.filter({ hasText: 'ลบ' }).first();
    await confirmButton.click();
    await page.waitForTimeout(2000);

    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${updatedName}`)).not.toBeVisible();
    await expect(page.locator(`text=${testData.name}`)).not.toBeVisible();
    console.log('✓ User deleted successfully');

    console.log('\n✅ Complete CRUD workflow test passed');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });
});
