/**
 * Accounting Module Permissions
 * Defines roles and permissions for the accounting module
 */

import { ROLES } from './index';

// Accounting-specific roles
export const ACCOUNTING_ROLES = {
  FINANCE_MANAGER: 'finance_manager',
  ACCOUNTANT: 'accountant',
  AR_CLERK: 'ar_clerk',
  AP_CLERK: 'ap_clerk',
  ASSET_MANAGER: 'asset_manager',
  AUDITOR: 'auditor',
} as const;

export type AccountingRole = typeof ACCOUNTING_ROLES[keyof typeof ACCOUNTING_ROLES];

// Combined roles that have accounting access
const ACCOUNTING_ADMIN = [ROLES.ADMIN, ACCOUNTING_ROLES.FINANCE_MANAGER];
const ACCOUNTING_FULL = [...ACCOUNTING_ADMIN, ACCOUNTING_ROLES.ACCOUNTANT];
const ACCOUNTING_READ = [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AR_CLERK, ACCOUNTING_ROLES.AP_CLERK, ACCOUNTING_ROLES.ASSET_MANAGER, ACCOUNTING_ROLES.AUDITOR];

/**
 * Accounting Module Permissions
 *
 * Permission naming convention: {module}:{entity}:{action}
 * - module: accounting
 * - entity: gl_accounts, journal_entries, ap_invoices, ar_invoices, payments, assets, reports, etc.
 * - action: read, write, delete, post, reverse, close, approve
 */
export const ACCOUNTING_PERMISSIONS = {
  // Chart of Accounts
  'accounting:gl_accounts:read': ACCOUNTING_READ,
  'accounting:gl_accounts:write': ACCOUNTING_FULL,
  'accounting:gl_accounts:delete': ACCOUNTING_ADMIN,
  'accounting:gl_accounts:export': ACCOUNTING_READ,

  // Account Types
  'accounting:gl_account_types:read': ACCOUNTING_READ,
  'accounting:gl_account_types:write': ACCOUNTING_ADMIN,

  // Journal Entries
  'accounting:journal_entries:read': ACCOUNTING_READ,
  'accounting:journal_entries:write': ACCOUNTING_FULL,
  'accounting:journal_entries:delete': ACCOUNTING_ADMIN,
  'accounting:journal_entries:post': ACCOUNTING_FULL,
  'accounting:journal_entries:reverse': ACCOUNTING_ADMIN,

  // Fiscal Years and Periods
  'accounting:fiscal_years:read': ACCOUNTING_READ,
  'accounting:fiscal_years:write': ACCOUNTING_ADMIN,
  'accounting:fiscal_periods:read': ACCOUNTING_READ,
  'accounting:fiscal_periods:write': ACCOUNTING_ADMIN,
  'accounting:fiscal_periods:close': ACCOUNTING_ADMIN,

  // Accounts Payable (AP)
  'accounting:ap_invoices:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AP_CLERK, ACCOUNTING_ROLES.AUDITOR, ROLES.PURCHASING],
  'accounting:ap_invoices:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AP_CLERK],
  'accounting:ap_invoices:delete': ACCOUNTING_ADMIN,
  'accounting:ap_invoices:approve': ACCOUNTING_FULL,
  'accounting:ap_invoices:post': ACCOUNTING_FULL,

  // Accounts Receivable (AR)
  'accounting:ar_invoices:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AR_CLERK, ACCOUNTING_ROLES.AUDITOR, ROLES.SALES],
  'accounting:ar_invoices:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AR_CLERK],
  'accounting:ar_invoices:delete': ACCOUNTING_ADMIN,
  'accounting:ar_invoices:confirm': ACCOUNTING_FULL,
  'accounting:ar_invoices:post': ACCOUNTING_FULL,

  // Payments
  'accounting:payments:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AP_CLERK, ACCOUNTING_ROLES.AR_CLERK, ACCOUNTING_ROLES.AUDITOR],
  'accounting:payments:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.AP_CLERK, ACCOUNTING_ROLES.AR_CLERK],
  'accounting:payments:void': ACCOUNTING_ADMIN,

  // VAT Transactions
  'accounting:vat:read': ACCOUNTING_READ,
  'accounting:vat:write': ACCOUNTING_FULL,
  'accounting:vat:report': ACCOUNTING_READ,

  // Withholding Tax (WHT)
  'accounting:wht:read': ACCOUNTING_READ,
  'accounting:wht:write': ACCOUNTING_FULL,
  'accounting:wht:report': ACCOUNTING_READ,

  // Fixed Assets
  'accounting:fixed_assets:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ACCOUNTING_ROLES.AUDITOR],
  'accounting:fixed_assets:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER],
  'accounting:fixed_assets:delete': ACCOUNTING_ADMIN,
  'accounting:fixed_assets:depreciate': ACCOUNTING_FULL,
  'accounting:fixed_assets:dispose': [...ACCOUNTING_ADMIN, ACCOUNTING_ROLES.ASSET_MANAGER],
  'accounting:fixed_assets:move': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER],

  // Asset Categories
  'accounting:asset_categories:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ACCOUNTING_ROLES.AUDITOR],
  'accounting:asset_categories:write': ACCOUNTING_ADMIN,

  // Equipment
  'accounting:equipment:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ACCOUNTING_ROLES.AUDITOR, ROLES.PRODUCTION],
  'accounting:equipment:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER],

  // Maintenance
  'accounting:maintenance_schedules:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ROLES.PRODUCTION],
  'accounting:maintenance_schedules:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER],
  'accounting:maintenance_records:read': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ROLES.PRODUCTION, ACCOUNTING_ROLES.AUDITOR],
  'accounting:maintenance_records:write': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ROLES.PRODUCTION],

  // Financial Reports
  'accounting:reports:trial_balance': ACCOUNTING_READ,
  'accounting:reports:balance_sheet': ACCOUNTING_READ,
  'accounting:reports:income_statement': ACCOUNTING_READ,
  'accounting:reports:aging': ACCOUNTING_READ,
  'accounting:reports:vat': ACCOUNTING_READ,
  'accounting:reports:wht': ACCOUNTING_READ,
  'accounting:reports:asset_register': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ACCOUNTING_ROLES.AUDITOR],
  'accounting:reports:depreciation': [...ACCOUNTING_FULL, ACCOUNTING_ROLES.ASSET_MANAGER, ACCOUNTING_ROLES.AUDITOR],

  // Settings
  'accounting:settings:read': ACCOUNTING_ADMIN,
  'accounting:settings:write': [ROLES.ADMIN, ACCOUNTING_ROLES.FINANCE_MANAGER],

  // Audit Trail
  'accounting:audit:read': [ROLES.ADMIN, ACCOUNTING_ROLES.FINANCE_MANAGER, ACCOUNTING_ROLES.AUDITOR],
} as const;

export type AccountingPermission = keyof typeof ACCOUNTING_PERMISSIONS;

/**
 * Check if a role has a specific accounting permission
 * @param role - User's role
 * @param permission - Permission to check
 * @returns True if role has permission
 */
export function hasAccountingPermission(
  role: string,
  permission: AccountingPermission
): boolean {
  const allowedRoles = ACCOUNTING_PERMISSIONS[permission];
  return Array.isArray(allowedRoles) && allowedRoles.includes(role as any);
}

/**
 * Get all permissions for a role in the accounting module
 * @param role - User's role
 * @returns List of permissions the role has
 */
export function getAccountingPermissionsForRole(role: string): AccountingPermission[] {
  const permissions: AccountingPermission[] = [];

  for (const [permission, roles] of Object.entries(ACCOUNTING_PERMISSIONS)) {
    if (Array.isArray(roles) && roles.includes(role as any)) {
      permissions.push(permission as AccountingPermission);
    }
  }

  return permissions;
}

/**
 * Menu items for the accounting module based on role
 */
export const ACCOUNTING_MENU = [
  {
    key: 'chart-of-accounts',
    label: 'Chart of Accounts',
    labelTh: 'ผังบัญชี',
    path: '/accounting/chart-of-accounts',
    icon: 'AccountBalance',
    permission: 'accounting:gl_accounts:read' as AccountingPermission,
  },
  {
    key: 'journal-entries',
    label: 'Journal Entries',
    labelTh: 'รายการบันทึกบัญชี',
    path: '/accounting/journal-entries',
    icon: 'Receipt',
    permission: 'accounting:journal_entries:read' as AccountingPermission,
  },
  {
    key: 'ap',
    label: 'Accounts Payable',
    labelTh: 'เจ้าหนี้การค้า',
    path: '/accounting/ap',
    icon: 'MoneyOff',
    permission: 'accounting:ap_invoices:read' as AccountingPermission,
    children: [
      { key: 'ap-invoices', label: 'AP Invoices', labelTh: 'ใบแจ้งหนี้', path: '/accounting/ap/invoices' },
      { key: 'ap-payments', label: 'Payments', labelTh: 'การชำระเงิน', path: '/accounting/ap/payments' },
      { key: 'ap-aging', label: 'Aging Report', labelTh: 'รายงานอายุหนี้', path: '/accounting/ap/aging' },
    ],
  },
  {
    key: 'ar',
    label: 'Accounts Receivable',
    labelTh: 'ลูกหนี้การค้า',
    path: '/accounting/ar',
    icon: 'AttachMoney',
    permission: 'accounting:ar_invoices:read' as AccountingPermission,
    children: [
      { key: 'ar-invoices', label: 'AR Invoices', labelTh: 'ใบแจ้งหนี้', path: '/accounting/ar/invoices' },
      { key: 'ar-receipts', label: 'Receipts', labelTh: 'การรับชำระ', path: '/accounting/ar/receipts' },
      { key: 'ar-aging', label: 'Aging Report', labelTh: 'รายงานอายุหนี้', path: '/accounting/ar/aging' },
    ],
  },
  {
    key: 'fixed-assets',
    label: 'Fixed Assets',
    labelTh: 'สินทรัพย์ถาวร',
    path: '/accounting/fixed-assets',
    icon: 'Business',
    permission: 'accounting:fixed_assets:read' as AccountingPermission,
    children: [
      { key: 'asset-register', label: 'Asset Register', labelTh: 'ทะเบียนสินทรัพย์', path: '/accounting/fixed-assets/register' },
      { key: 'asset-categories', label: 'Categories', labelTh: 'หมวดหมู่', path: '/accounting/fixed-assets/categories' },
      { key: 'depreciation', label: 'Depreciation', labelTh: 'ค่าเสื่อมราคา', path: '/accounting/fixed-assets/depreciation' },
    ],
  },
  {
    key: 'equipment',
    label: 'Equipment',
    labelTh: 'อุปกรณ์',
    path: '/accounting/equipment',
    icon: 'Build',
    permission: 'accounting:equipment:read' as AccountingPermission,
    children: [
      { key: 'equipment-list', label: 'Equipment List', labelTh: 'รายการอุปกรณ์', path: '/accounting/equipment/list' },
      { key: 'maintenance', label: 'Maintenance', labelTh: 'การบำรุงรักษา', path: '/accounting/equipment/maintenance' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    labelTh: 'รายงาน',
    path: '/accounting/reports',
    icon: 'Assessment',
    permission: 'accounting:reports:trial_balance' as AccountingPermission,
    children: [
      { key: 'trial-balance', label: 'Trial Balance', labelTh: 'งบทดลอง', path: '/accounting/reports/trial-balance' },
      { key: 'balance-sheet', label: 'Balance Sheet', labelTh: 'งบดุล', path: '/accounting/reports/balance-sheet' },
      { key: 'income-statement', label: 'Income Statement', labelTh: 'งบกำไรขาดทุน', path: '/accounting/reports/income-statement' },
      { key: 'vat-report', label: 'VAT Report', labelTh: 'รายงานภาษีมูลค่าเพิ่ม', path: '/accounting/reports/vat' },
      { key: 'wht-report', label: 'WHT Report', labelTh: 'รายงานหัก ณ ที่จ่าย', path: '/accounting/reports/wht' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    labelTh: 'ตั้งค่า',
    path: '/accounting/settings',
    icon: 'Settings',
    permission: 'accounting:settings:read' as AccountingPermission,
    children: [
      { key: 'fiscal-years', label: 'Fiscal Years', labelTh: 'ปีบัญชี', path: '/accounting/settings/fiscal-years' },
      { key: 'account-types', label: 'Account Types', labelTh: 'ประเภทบัญชี', path: '/accounting/settings/account-types' },
    ],
  },
];

/**
 * Get menu items filtered by user's role
 * @param role - User's role
 * @returns Filtered menu items
 */
export function getAccountingMenuForRole(role: string) {
  return ACCOUNTING_MENU.filter((item) => hasAccountingPermission(role, item.permission));
}
