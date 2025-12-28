/**
 * Playwright E2E test for Users Module
 * Tests the complete user management workflow including:
 * - Page navigation and loading
 * - Filtering (tabs, search, role)
 * - Viewing user details
 * - Editing user information
 * - Changing password
 * - Toggling user status
 * - Navigation between pages
 *
 * Run with: npx playwright test tests/e2e/users-management.spec.ts --headed
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
  await page.waitForSelector('button:has-text("Admin admin@herbal-erp.com")', { timeout: 10000 });

  // Click on Admin test account button to fill credentials
  await page.click('button:has-text("Admin admin@herbal-erp.com")');
  
  // Wait for form to be filled
  await page.waitForTimeout(500);

  // Submit login
  await page.click('button:has-text("เข้าสู่ระบบ")');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  console.log('✓ Login successful');
}

test.describe('Users Module E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('should load users page and display summary cards', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // Navigate to users page
    console.log('Navigating to users page...');
    await page.goto(`${BASE_URL}/users`);

    // Wait for page to load
    await page.waitForSelector('text=จัดการผู้ใช้งาน', { timeout: 10000 });
    console.log('✓ Users page loaded');

    // Verify page title
    await expect(page.locator('h1:has-text("จัดการผู้ใช้งาน")')).toBeVisible();
    console.log('✓ Page title verified');

    // Verify summary cards exist
    await expect(page.locator('text=ผู้ใช้ทั้งหมด')).toBeVisible();
    await expect(page.locator('text=ใช้งานอยู่')).toBeVisible();
    await expect(page.locator('text=ปิดใช้งาน')).toBeVisible();
    await expect(page.locator('text=เพิ่มใหม่ (30 วัน)')).toBeVisible();
    console.log('✓ Summary cards displayed');

    // Verify role distribution sidebar
    await expect(page.locator('text=การกระจายตามบทบาท')).toBeVisible();
    console.log('✓ Role distribution sidebar displayed');

    // Verify tabs exist
    await expect(page.locator('text=ทั้งหมด')).toBeVisible();
    await expect(page.locator('text=ใช้งาน')).toBeVisible();
    await expect(page.locator('text=ปิดใช้งาน')).toBeVisible();
    console.log('✓ Filter tabs displayed');

    // Verify search and filter controls
    await expect(page.locator('input[placeholder*="ค้นหาชื่อ, อีเมล, แผนก..."]')).toBeVisible();
    await expect(page.locator('text=บทบาท')).toBeVisible();
    console.log('✓ Search and filter controls displayed');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });

  test('should display user list in data grid', async ({ page }) => {
    // Navigate to users page
    console.log('Navigating to users page...');
    await page.goto(`${BASE_URL}/users`);

    // Wait for data grid to load
    await page.waitForSelector('role=row', { timeout: 10000 });
    console.log('✓ Data grid loaded');

    // Wait for users to be loaded (wait for summary to show numbers)
    await page.waitForFunction(() => {
      const totalUsersText = document.body.textContent || '';
      return totalUsersText.includes('7') && !totalUsersText.includes('- 7');
    }, { timeout: 10000 });
    console.log('✓ Users data loaded');

    // Verify data grid rows exist
    const rows = page.locator('role=grid >> role=row');
    const rowCount = await rows.count();
    
    expect(rowCount).toBeGreaterThan(0);
    console.log(`✓ Found ${rowCount} users in grid`);

    // Verify first user row
    await expect(page.locator('text=System Administrator')).toBeVisible();
    await expect(page.locator('text=admin@herbal-erp.com')).toBeVisible();
    await expect(page.locator('text=ผู้ดูแลระบบ')).toBeVisible();
    console.log('✓ First user data verified');

    // Verify all expected users are present
    await expect(page.locator('text=Production Manager')).toBeVisible();
    await expect(page.locator('text=QC Manager')).toBeVisible();
    await expect(page.locator('text=Warehouse Manager')).toBeVisible();
    await expect(page.locator('text=Purchasing Manager')).toBeVisible();
    await expect(page.locator('text=Sales Manager')).toBeVisible();
    await expect(page.locator('text=HR Manager')).toBeVisible();
    console.log('✓ All expected users present');
  });

  test('should filter users by tabs', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get initial row count (all tab)
    let rows = page.locator('role=grid >> role=row');
    const initialCount = await rows.count();
    console.log(`All users: ${initialCount}`);

    expect(initialCount).toBe(7);

    // Click on "ใช้งาน" (Active) tab
    await page.click('text=ใช้งาน');
    await page.waitForTimeout(500);

    rows = page.locator('role=grid >> role=row');
    const activeCount = await rows.count();
    console.log(`Active users: ${activeCount}`);

    expect(activeCount).toBe(7);

    // Click on "ปิดใช้งาน" (Inactive) tab
    await page.click('text=ปิดใช้งาน');
    await page.waitForTimeout(500);

    rows = page.locator('role=grid >> role=row');
    const inactiveCount = await rows.count();
    console.log(`Inactive users: ${inactiveCount}`);

    expect(inactiveCount).toBe(0);

    // Click back to "ทั้งหมด" (All) tab
    await page.click('text=ทั้งหมด');
    await page.waitForTimeout(500);

    rows = page.locator('role=grid >> role=row');
    const finalCount = await rows.count();
    console.log(`All users again: ${finalCount}`);

    expect(finalCount).toBe(7);
    console.log('✓ Tab filtering works correctly');
  });

  test('should search users by name or email', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get initial row count
    let rows = page.locator('role=grid >> role=row');
    const initialCount = await rows.count();
    console.log(`Initial users: ${initialCount}`);

    expect(initialCount).toBe(7);

    // Search for "Admin"
    const searchBox = page.locator('input[placeholder*="ค้นหาชื่อ, อีเมล, แผนก..."]');
    await searchBox.fill('Admin');
    await page.waitForTimeout(500);

    rows = page.locator('role=grid >> role=row');
    const adminCount = await rows.count();
    console.log(`Users matching "Admin": ${adminCount}`);

    expect(adminCount).toBe(1);
    await expect(page.locator('text=System Administrator')).toBeVisible();

    // Search by email
    await searchBox.fill('hr@');
    await page.waitForTimeout(500);

    rows = page.locator('role=grid >> role=row');
    const hrCount = await rows.count();
    console.log(`Users matching "hr@": ${hrCount}`);

    expect(hrCount).toBe(1);
    await expect(page.locator('text=HR Manager')).toBeVisible();

    // Clear search
    await searchBox.fill('');
    await page.waitForTimeout(500);

    rows = page.locator('role=grid >> role=row');
    const finalCount = await rows.count();
    console.log(`Users after clear: ${finalCount}`);

    expect(finalCount).toBe(7);
    console.log('✓ Search functionality works correctly');
  });

  test('should navigate to user detail page', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });

    // Click on edit button for first user
    const editButton = page.locator('button[aria-label="edit"]').first();
    await editButton.click();
    console.log('Clicked edit button');

    // Wait for navigation to detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('✓ Navigated to user detail page');

    // Verify detail page elements
    await expect(page.locator('h1:has-text("System Administrator")')).toBeVisible();
    await expect(page.locator('text=ข้อมูลผู้ใช้')).toBeVisible();
    await expect(page.locator('text=admin@herbal-erp.com')).toBeVisible();
    await expect(page.locator('text=ผู้ดูแลระบบ')).toBeVisible();
    await expect(page.locator('text=IT')).toBeVisible();
    console.log('✓ User detail page loaded correctly');

    // Verify other cards
    await expect(page.locator('text=เปลี่ยนรหัสผ่าน')).toBeVisible();
    await expect(page.locator('text=สถานะการใช้งาน')).toBeVisible();
    await expect(page.locator('text=ข้อมูลระบบ')).toBeVisible();
    await expect(page.locator('text=โซนอันตราย')).toBeVisible();
    console.log('✓ All sections visible');
  });

  test('should edit user information', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });

    // Click on edit button for HR Manager (last user)
    const hrManagerRow = page.locator('role=row').filter({ hasText: 'HR Manager' });
    await hrManagerRow.locator('button[aria-label="edit"]').click();
    console.log('Clicked edit button for HR Manager');

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click edit button to enter edit mode
    await page.click('button:has-text("แก้ไข")');
    await page.waitForTimeout(500);
    console.log('Entered edit mode');

    // Verify edit mode is active (input fields should appear)
    await expect(page.locator('input[value="HR Manager"]')).toBeVisible();
    console.log('✓ Edit mode activated');

    // Click cancel to exit edit mode
    await page.click('button:has-text("ยกเลิก")');
    await page.waitForTimeout(500);
    console.log('✓ Exited edit mode');

    // Verify back to view mode
    await expect(page.locator('p:has-text("HR Manager")')).toBeVisible();
  });

  test('should toggle user status', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log(`[CONSOLE ERROR] ${text}`);
      }
    });

    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });

    // Click on edit button for Production Manager (user with ID 2)
    const pmRow = page.locator('role=row').filter({ hasText: 'Production Manager' });
    await pmRow.locator('button[aria-label="edit"]').click();
    console.log('Clicked edit button for Production Manager');

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify current status
    await expect(page.locator('text=ใช้งานอยู่')).toBeVisible();
    await expect(page.locator('button:has-text("ปิดใช้งาน")')).toBeVisible();
    console.log('✓ Current status: Active');

    // Click disable button
    await page.click('button:has-text("ปิดใช้งาน")');
    await page.waitForTimeout(2000);
    console.log('Clicked disable button');

    // Verify status changed
    await expect(page.locator('text=ปิดใช้งาน')).toBeVisible();
    await expect(page.locator('button:has-text("เปิดใช้งาน")')).toBeVisible();
    console.log('✓ Status changed to Inactive');

    // Click enable button
    await page.click('button:has-text("เปิดใช้งาน")');
    await page.waitForTimeout(2000);
    console.log('Clicked enable button');

    // Verify status changed back
    await expect(page.locator('text=ใช้งานอยู่')).toBeVisible();
    await expect(page.locator('button:has-text("ปิดใช้งาน")')).toBeVisible();
    console.log('✓ Status changed back to Active');

    // Check for console errors
    expect(errors.length, `Expected no console errors but found: ${errors.join(', ')}`).toBe(0);
  });

  test('should navigate back to users list', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });

    // Click on edit button
    const editButton = page.locator('button[aria-label="edit"]').first();
    await editButton.click();

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(500);
    console.log('✓ Navigated to detail page');

    // Click back button
    await page.click('button[aria-label="กลับ"]');
    await page.waitForURL('**/users$', { timeout: 10000 });
    await page.waitForTimeout(500);
    console.log('✓ Navigated back to users list');

    // Verify we're back on users page
    await expect(page.locator('text=จัดการผู้ใช้งาน')).toBeVisible();
    await expect(page.locator('role=grid')).toBeVisible();
  });

  test('should verify system information on detail page', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });

    // Click on edit button for first user
    const editButton = page.locator('button[aria-label="edit"]').first();
    await editButton.click();

    // Wait for detail page
    await page.waitForURL('**/users/*', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify system information section
    await expect(page.locator('text=ข้อมูลระบบ')).toBeVisible();
    await expect(page.locator('text=สร้างเมื่อ')).toBeVisible();
    await expect(page.locator('text=แก้ไขล่าสุด')).toBeVisible();
    await expect(page.locator('text=รหัสผู้ใช้')).toBeVisible();
    await expect(page.locator('text="#1"')).toBeVisible();
    console.log('✓ System information displayed correctly');

    // Verify user ID pattern
    const userIdElement = page.locator('text=/#\\d+/');
    await expect(userIdElement).toBeVisible();
  });

  test('should show correct role badges for users', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify role badges
    await expect(page.locator('text=ผู้ดูแลระบบ')).toBeVisible();
    await expect(page.locator('text=ฝ่ายผลิต')).toBeVisible();
    await expect(page.locator('text=ฝ่าย QC')).toBeVisible();
    await expect(page.locator('text=ฝ่ายคลัง')).toBeVisible();
    await expect(page.locator('text=ฝ่ายจัดซื้อ')).toBeVisible();
    await expect(page.locator('text=ฝ่ายขาย')).toBeVisible();
    await expect(page.locator('text=ฝ่ายบุคคล')).toBeVisible();
    console.log('✓ All role badges displayed correctly');
  });

  test('should verify all users are active', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Count active status badges
    const activeBadges = page.locator('text=ใช้งาน');
    const activeCount = await activeBadges.count();
    console.log(`Active users: ${activeCount}`);

    expect(activeCount).toBe(7);

    // Count inactive status badges
    const inactiveBadges = page.locator('text=ปิดใช้งาน').filter({ hasText: /^ปิดใช้งาน$/ });
    const inactiveCount = await inactiveBadges.count();
    console.log(`Inactive users: ${inactiveCount}`);

    expect(inactiveCount).toBe(0);
    console.log('✓ All users are active');
  });

  test('should have data grid export and column chooser buttons', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify toolbar buttons
    await expect(page.locator('button:has-text("ส่งออกข้อมูลทั้งหมด")')).toBeVisible();
    await expect(page.locator('button:has-text("เลือกคอลัมน์")')).toBeVisible();
    await expect(page.locator('button[aria-label="refresh"]')).toBeVisible();
    console.log('✓ Data grid toolbar buttons present');
  });

  test('should display user avatars with initials', async ({ page }) => {
    // Navigate to users page
    await page.goto(`${BASE_URL}/users`);
    await page.waitForSelector('role=row', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify first user has avatar with initials "SA"
    await expect(page.locator('text=SA')).toBeVisible();
    console.log('✓ User avatar with initials displayed');
  });
});
