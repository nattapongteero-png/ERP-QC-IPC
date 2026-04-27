/**
 * Generate Role-Permission Matrix Excel Report
 * Run: npx tsx scripts/generate-role-permission-report.ts
 */

import ExcelJS from 'exceljs';
import path from 'path';

// ===== DATA =====

const ROLES_IN_DROPDOWN = [
  { value: 'admin', labelTh: 'ผู้ดูแลระบบ', labelEn: 'System Administrator' },
  { value: 'manager', labelTh: 'ผู้จัดการ', labelEn: 'Manager' },
  { value: 'production', labelTh: 'ฝ่ายผลิต', labelEn: 'Production' },
  { value: 'qc', labelTh: 'ฝ่าย QC', labelEn: 'Quality Control' },
  { value: 'warehouse', labelTh: 'ฝ่ายคลัง', labelEn: 'Warehouse' },
  { value: 'purchasing', labelTh: 'ฝ่ายจัดซื้อ', labelEn: 'Purchasing' },
  { value: 'sales', labelTh: 'ฝ่ายขาย', labelEn: 'Sales' },
  { value: 'accounting', labelTh: 'ฝ่ายบัญชี', labelEn: 'Accounting' },
  { value: 'hr', labelTh: 'ฝ่ายบุคคล', labelEn: 'Human Resources' },
  { value: 'user', labelTh: 'ผู้ใช้ทั่วไป', labelEn: 'General User' },
];

const ALL_ROLES_IN_SYSTEM = [
  'admin', 'manager', 'production', 'qc', 'warehouse',
  'purchasing', 'sales', 'hr', 'hr_admin', 'hr_staff',
  'health_staff', 'finance', 'accountant', 'user',
];

const ROLE_COLUMNS = [
  'admin', 'manager', 'production', 'qc', 'warehouse',
  'purchasing', 'sales', 'accounting', 'hr', 'user',
  'finance', 'accountant', 'hr_admin', 'hr_staff', 'health_staff',
];

// Exact copy from src/lib/auth/index.ts
const PERMISSIONS: Record<string, string[]> = {
  'users:read': ['admin', 'manager'],
  'users:write': ['admin'],
  'users:delete': ['admin'],
  'items:read': ['admin', 'manager', 'production', 'qc', 'warehouse', 'purchasing', 'sales'],
  'items:write': ['admin', 'manager'],
  'items:delete': ['admin'],
  'inventory:read': ['admin', 'manager', 'production', 'qc', 'warehouse'],
  'inventory:write': ['admin', 'manager', 'warehouse'],
  'inventory:adjust': ['admin', 'manager'],
  'production:read': ['admin', 'manager', 'production', 'qc'],
  'production:write': ['admin', 'manager', 'production'],
  'production:approve': ['admin', 'manager'],
  'quality:read': ['admin', 'manager', 'production', 'qc'],
  'quality:write': ['admin', 'manager', 'qc'],
  'quality:approve': ['admin', 'manager', 'qc'],
  'purchasing:read': ['admin', 'manager', 'purchasing', 'warehouse'],
  'purchasing:write': ['admin', 'manager', 'purchasing'],
  'purchasing:approve': ['admin', 'manager'],
  'sales:read': ['admin', 'manager', 'sales', 'warehouse'],
  'sales:write': ['admin', 'manager', 'sales'],
  'sales:approve': ['admin', 'manager'],
  'reports:read': ['admin', 'manager', 'hr', 'production', 'qc', 'warehouse', 'purchasing', 'sales', 'finance', 'accountant'],
  'reports:export': ['admin', 'manager', 'hr'],
  'settings:read': ['admin', 'manager'],
  'settings:write': ['admin'],
  'hr:read': ['admin', 'manager', 'hr', 'hr_admin', 'hr_staff'],
  'hr:write': ['admin', 'manager', 'hr', 'hr_admin', 'hr_staff'],
  'hr:admin': ['admin', 'hr', 'hr_admin'],
  'hr:health_staff': ['admin', 'hr', 'hr_admin', 'health_staff'],
  'vmi-settings:read': ['admin', 'manager', 'sales'],
  'vmi-settings:write': ['admin', 'manager'],
  'vmi-sync:execute': ['admin', 'manager', 'sales'],
  'vmi-orders:read': ['admin', 'manager', 'sales', 'warehouse'],
  'vmi-orders:write': ['admin', 'manager', 'sales'],
  'documents:read': ['admin', 'manager', 'qc', 'production'],
  'documents:write': ['admin', 'manager', 'qc'],
  'documents:approve': ['admin', 'manager', 'qc'],
  'capa:read': ['admin', 'manager', 'qc', 'production'],
  'capa:write': ['admin', 'manager', 'qc'],
  'capa:close': ['admin', 'manager', 'qc'],
  'complaints:read': ['admin', 'manager', 'qc', 'sales'],
  'complaints:write': ['admin', 'manager', 'qc', 'sales'],
  'complaints:investigate': ['admin', 'manager', 'qc'],
  'complaints:close': ['admin', 'manager', 'qc'],
  'recalls:read': ['admin', 'manager', 'qc', 'sales', 'warehouse'],
  'recalls:write': ['admin', 'manager', 'qc'],
  'recalls:execute': ['admin', 'manager', 'qc', 'warehouse'],
  'recalls:close': ['admin', 'manager', 'qc'],
  'stability:read': ['admin', 'manager', 'qc', 'production'],
  'stability:write': ['admin', 'manager', 'qc'],
  'stability:approve': ['admin', 'manager', 'qc'],
  'sanitation:read': ['admin', 'manager', 'qc', 'production', 'warehouse'],
  'sanitation:write': ['admin', 'manager', 'qc', 'production'],
  'sanitation:verify': ['admin', 'manager', 'qc'],
  'audit:read': ['admin', 'manager', 'qc'],
  'audit:write': ['admin', 'manager', 'qc'],
  'audit:approve': ['admin', 'manager'],
  'pqr:read': ['admin', 'manager', 'qc', 'production'],
  'pqr:write': ['admin', 'manager', 'qc'],
  'pqr:approve': ['admin', 'manager', 'qc'],
  'pqr:delete': ['admin', 'manager'],
  'change_control:read': ['admin', 'manager', 'qc', 'production'],
  'change_control:write': ['admin', 'manager', 'qc'],
  'change_control:approve': ['admin', 'manager', 'qc'],
  'accounting:gl_accounts:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:gl_accounts:write': ['admin', 'finance', 'accountant'],
  'accounting:gl_accounts:delete': ['admin', 'finance'],
  'accounting:gl_account_types:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:gl_account_types:write': ['admin', 'finance'],
  'accounting:journal_entries:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:journal_entries:write': ['admin', 'finance', 'accountant'],
  'accounting:journal_entries:post': ['admin', 'finance', 'accountant'],
  'accounting:journal_entries:reverse': ['admin', 'finance'],
  'accounting:fiscal_periods:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:fiscal_periods:write': ['admin', 'finance'],
  'accounting:fiscal_periods:close': ['admin', 'finance'],
  'accounting:ap_invoices:read': ['admin', 'manager', 'finance', 'accountant', 'purchasing'],
  'accounting:ap_invoices:write': ['admin', 'finance', 'accountant'],
  'accounting:ap_invoices:approve': ['admin', 'finance'],
  'accounting:ap_invoices:pay': ['admin', 'finance', 'accountant'],
  'accounting:ar_invoices:read': ['admin', 'manager', 'finance', 'accountant', 'sales'],
  'accounting:ar_invoices:write': ['admin', 'finance', 'accountant'],
  'accounting:ar_invoices:confirm': ['admin', 'finance'],
  'accounting:payments:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:payments:write': ['admin', 'finance', 'accountant'],
  'accounting:cost_allocation:read': ['admin', 'manager', 'finance', 'accountant', 'production'],
  'accounting:cost_allocation:write': ['admin', 'finance', 'accountant'],
  'accounting:fixed_assets:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:fixed_assets:write': ['admin', 'finance', 'accountant'],
  'accounting:asset_categories:read': ['admin', 'manager', 'finance', 'accountant'],
  'accounting:asset_categories:write': ['admin', 'finance'],
  'accounting:equipment:read': ['admin', 'manager', 'finance', 'accountant', 'production'],
  'accounting:equipment:write': ['admin', 'finance', 'accountant'],
  'accounting:maintenance:read': ['admin', 'manager', 'finance', 'production'],
  'accounting:maintenance:write': ['admin', 'finance', 'production'],
  'accounting:reports:read': ['admin', 'manager', 'finance', 'accountant'],
  'cost:read': ['admin', 'manager', 'finance', 'accountant', 'purchasing', 'production'],
  'cost:write': ['admin', 'manager', 'finance', 'accountant'],
  'admin:read': ['admin'],
  'admin:write': ['admin'],
  'issues:read': ['admin', 'manager', 'qc', 'production', 'user'],
  'issues:write': ['admin', 'manager', 'qc', 'production', 'user'],
  'issues:assign': ['admin', 'manager'],
  'issues:delete': ['admin'],
};

// Module grouping for permissions
const PERMISSION_GROUPS: { group: string; groupTh: string; permissions: string[] }[] = [
  {
    group: 'User Management', groupTh: 'จัดการผู้ใช้',
    permissions: ['users:read', 'users:write', 'users:delete'],
  },
  {
    group: 'Items / Products', groupTh: 'สินค้า/วัตถุดิบ',
    permissions: ['items:read', 'items:write', 'items:delete'],
  },
  {
    group: 'Inventory', groupTh: 'คลังสินค้า',
    permissions: ['inventory:read', 'inventory:write', 'inventory:adjust'],
  },
  {
    group: 'Production', groupTh: 'การผลิต',
    permissions: ['production:read', 'production:write', 'production:approve'],
  },
  {
    group: 'Quality Control', groupTh: 'ควบคุมคุณภาพ',
    permissions: ['quality:read', 'quality:write', 'quality:approve'],
  },
  {
    group: 'Purchasing', groupTh: 'จัดซื้อ',
    permissions: ['purchasing:read', 'purchasing:write', 'purchasing:approve'],
  },
  {
    group: 'Sales', groupTh: 'ขาย',
    permissions: ['sales:read', 'sales:write', 'sales:approve'],
  },
  {
    group: 'HR', groupTh: 'บุคลากร',
    permissions: ['hr:read', 'hr:write', 'hr:admin', 'hr:health_staff'],
  },
  {
    group: 'Reports', groupTh: 'รายงาน',
    permissions: ['reports:read', 'reports:export'],
  },
  {
    group: 'Settings', groupTh: 'ตั้งค่าระบบ',
    permissions: ['settings:read', 'settings:write'],
  },
  {
    group: 'Admin', groupTh: 'ผู้ดูแลระบบ',
    permissions: ['admin:read', 'admin:write'],
  },
  {
    group: 'VMI Portal', groupTh: 'VMI Portal',
    permissions: ['vmi-settings:read', 'vmi-settings:write', 'vmi-sync:execute', 'vmi-orders:read', 'vmi-orders:write'],
  },
  {
    group: 'Documents (GMP)', groupTh: 'เอกสาร GMP (หมวด 5)',
    permissions: ['documents:read', 'documents:write', 'documents:approve'],
  },
  {
    group: 'CAPA', groupTh: 'CAPA (หมวด 1)',
    permissions: ['capa:read', 'capa:write', 'capa:close'],
  },
  {
    group: 'Complaints', groupTh: 'เรื่องร้องเรียน (หมวด 9)',
    permissions: ['complaints:read', 'complaints:write', 'complaints:investigate', 'complaints:close'],
  },
  {
    group: 'Recalls', groupTh: 'เรียกคืน (หมวด 9)',
    permissions: ['recalls:read', 'recalls:write', 'recalls:execute', 'recalls:close'],
  },
  {
    group: 'Stability', groupTh: 'Stability (หมวด 7.4)',
    permissions: ['stability:read', 'stability:write', 'stability:approve'],
  },
  {
    group: 'Sanitation', groupTh: 'สุขาภิบาล (หมวด 4)',
    permissions: ['sanitation:read', 'sanitation:write', 'sanitation:verify'],
  },
  {
    group: 'Internal Audit', groupTh: 'ตรวจสอบภายใน (หมวด 10)',
    permissions: ['audit:read', 'audit:write', 'audit:approve'],
  },
  {
    group: 'PQR', groupTh: 'Product Quality Review (หมวด 1)',
    permissions: ['pqr:read', 'pqr:write', 'pqr:approve', 'pqr:delete'],
  },
  {
    group: 'Change Control', groupTh: 'Change Control (หมวด 8)',
    permissions: ['change_control:read', 'change_control:write', 'change_control:approve'],
  },
  {
    group: 'Issues', groupTh: 'แจ้งปัญหา',
    permissions: ['issues:read', 'issues:write', 'issues:assign', 'issues:delete'],
  },
  {
    group: 'Accounting - GL', groupTh: 'บัญชี - ผังบัญชี',
    permissions: ['accounting:gl_accounts:read', 'accounting:gl_accounts:write', 'accounting:gl_accounts:delete', 'accounting:gl_account_types:read', 'accounting:gl_account_types:write'],
  },
  {
    group: 'Accounting - Journal', groupTh: 'บัญชี - สมุดรายวัน',
    permissions: ['accounting:journal_entries:read', 'accounting:journal_entries:write', 'accounting:journal_entries:post', 'accounting:journal_entries:reverse'],
  },
  {
    group: 'Accounting - Fiscal', groupTh: 'บัญชี - งวดบัญชี',
    permissions: ['accounting:fiscal_periods:read', 'accounting:fiscal_periods:write', 'accounting:fiscal_periods:close'],
  },
  {
    group: 'Accounting - AP', groupTh: 'บัญชี - เจ้าหนี้',
    permissions: ['accounting:ap_invoices:read', 'accounting:ap_invoices:write', 'accounting:ap_invoices:approve', 'accounting:ap_invoices:pay'],
  },
  {
    group: 'Accounting - AR', groupTh: 'บัญชี - ลูกหนี้',
    permissions: ['accounting:ar_invoices:read', 'accounting:ar_invoices:write', 'accounting:ar_invoices:confirm'],
  },
  {
    group: 'Accounting - Payments', groupTh: 'บัญชี - การชำระเงิน',
    permissions: ['accounting:payments:read', 'accounting:payments:write'],
  },
  {
    group: 'Accounting - Cost Allocation', groupTh: 'บัญชี - การปันส่วนต้นทุน',
    permissions: ['accounting:cost_allocation:read', 'accounting:cost_allocation:write'],
  },
  {
    group: 'Accounting - Fixed Assets', groupTh: 'บัญชี - สินทรัพย์ถาวร',
    permissions: ['accounting:fixed_assets:read', 'accounting:fixed_assets:write', 'accounting:asset_categories:read', 'accounting:asset_categories:write'],
  },
  {
    group: 'Accounting - Equipment', groupTh: 'บัญชี - อุปกรณ์/บำรุงรักษา',
    permissions: ['accounting:equipment:read', 'accounting:equipment:write', 'accounting:maintenance:read', 'accounting:maintenance:write'],
  },
  {
    group: 'Accounting - Reports', groupTh: 'บัญชี - รายงาน',
    permissions: ['accounting:reports:read'],
  },
  {
    group: 'Cost Management', groupTh: 'การจัดการต้นทุน',
    permissions: ['cost:read', 'cost:write'],
  },
];

const PERMISSION_LABELS: Record<string, string> = {
  'users:read': 'ดูข้อมูลผู้ใช้',
  'users:write': 'สร้าง/แก้ไขผู้ใช้',
  'users:delete': 'ลบผู้ใช้',
  'items:read': 'ดูสินค้า/วัตถุดิบ',
  'items:write': 'สร้าง/แก้ไขสินค้า',
  'items:delete': 'ลบสินค้า',
  'inventory:read': 'ดูสต็อก',
  'inventory:write': 'บันทึกเคลื่อนไหว',
  'inventory:adjust': 'ปรับปรุงยอดสต็อก',
  'production:read': 'ดู BOM/Work Orders',
  'production:write': 'สร้าง/แก้ไข Work Orders',
  'production:approve': 'อนุมัติเอกสารผลิต',
  'quality:read': 'ดูผลตรวจ QC',
  'quality:write': 'บันทึกผลทดสอบ',
  'quality:approve': 'อนุมัติ QC Disposition',
  'purchasing:read': 'ดู PR/PO',
  'purchasing:write': 'สร้าง/แก้ไข PR/PO',
  'purchasing:approve': 'อนุมัติใบขอซื้อ',
  'sales:read': 'ดูคำสั่งซื้อ',
  'sales:write': 'สร้าง/แก้ไขคำสั่งซื้อ',
  'sales:approve': 'อนุมัติคำสั่งซื้อ',
  'reports:read': 'ดูรายงาน',
  'reports:export': 'ส่งออกรายงาน',
  'settings:read': 'ดูตั้งค่าระบบ',
  'settings:write': 'แก้ไขตั้งค่าระบบ',
  'hr:read': 'ดูข้อมูลบุคลากร',
  'hr:write': 'สร้าง/แก้ไขข้อมูลบุคลากร',
  'hr:admin': 'จัดการบทบาท/สิทธิ์',
  'hr:health_staff': 'จัดการบันทึกสุขภาพ',
  'vmi-settings:read': 'ดูตั้งค่า VMI',
  'vmi-settings:write': 'แก้ไขตั้งค่า VMI',
  'vmi-sync:execute': 'Sync ข้อมูล VMI',
  'vmi-orders:read': 'ดูคำสั่งซื้อ VMI',
  'vmi-orders:write': 'จัดการคำสั่งซื้อ VMI',
  'documents:read': 'ดูเอกสาร GMP/SOP',
  'documents:write': 'สร้าง/แก้ไขเอกสาร',
  'documents:approve': 'อนุมัติเอกสาร',
  'capa:read': 'ดู CAPA',
  'capa:write': 'สร้าง/แก้ไข CAPA',
  'capa:close': 'ปิด CAPA',
  'complaints:read': 'ดูเรื่องร้องเรียน',
  'complaints:write': 'สร้าง/แก้ไขเรื่องร้องเรียน',
  'complaints:investigate': 'สอบสวนเรื่องร้องเรียน',
  'complaints:close': 'ปิดเรื่องร้องเรียน',
  'recalls:read': 'ดูการเรียกคืน',
  'recalls:write': 'สร้าง/แก้ไขการเรียกคืน',
  'recalls:execute': 'ดำเนินการเรียกคืน',
  'recalls:close': 'ปิดการเรียกคืน',
  'stability:read': 'ดู Stability Studies',
  'stability:write': 'สร้าง/แก้ไข Stability',
  'stability:approve': 'อนุมัติ Stability',
  'sanitation:read': 'ดูสุขาภิบาล',
  'sanitation:write': 'บันทึกสุขาภิบาล',
  'sanitation:verify': 'ตรวจสอบสุขาภิบาล',
  'audit:read': 'ดูตรวจสอบภายใน',
  'audit:write': 'สร้าง/แก้ไขตรวจสอบภายใน',
  'audit:approve': 'อนุมัติตรวจสอบภายใน',
  'pqr:read': 'ดู PQR',
  'pqr:write': 'สร้าง/แก้ไข PQR',
  'pqr:approve': 'อนุมัติ PQR',
  'pqr:delete': 'ลบ PQR',
  'change_control:read': 'ดู Change Control',
  'change_control:write': 'สร้าง/แก้ไข Change Control',
  'change_control:approve': 'อนุมัติ Change Control',
  'issues:read': 'ดู Issues',
  'issues:write': 'สร้าง/แก้ไข Issues',
  'issues:assign': 'มอบหมาย Issues',
  'issues:delete': 'ลบ Issues',
  'accounting:gl_accounts:read': 'ดูผังบัญชี',
  'accounting:gl_accounts:write': 'สร้าง/แก้ไขผังบัญชี',
  'accounting:gl_accounts:delete': 'ลบผังบัญชี',
  'accounting:gl_account_types:read': 'ดูประเภทบัญชี',
  'accounting:gl_account_types:write': 'สร้าง/แก้ไขประเภทบัญชี',
  'accounting:journal_entries:read': 'ดูสมุดรายวัน',
  'accounting:journal_entries:write': 'สร้าง/แก้ไขสมุดรายวัน',
  'accounting:journal_entries:post': 'ผ่านรายการ',
  'accounting:journal_entries:reverse': 'กลับรายการ',
  'accounting:fiscal_periods:read': 'ดูงวดบัญชี',
  'accounting:fiscal_periods:write': 'สร้าง/แก้ไขงวดบัญชี',
  'accounting:fiscal_periods:close': 'ปิดงวดบัญชี',
  'accounting:ap_invoices:read': 'ดูใบแจ้งหนี้ AP',
  'accounting:ap_invoices:write': 'สร้าง/แก้ไขใบแจ้งหนี้ AP',
  'accounting:ap_invoices:approve': 'อนุมัติใบแจ้งหนี้ AP',
  'accounting:ap_invoices:pay': 'บันทึกจ่ายเงิน',
  'accounting:ar_invoices:read': 'ดูใบแจ้งหนี้ AR',
  'accounting:ar_invoices:write': 'สร้าง/แก้ไขใบแจ้งหนี้ AR',
  'accounting:ar_invoices:confirm': 'ยืนยัน AR',
  'accounting:payments:read': 'ดูการชำระเงิน',
  'accounting:payments:write': 'บันทึกการชำระเงิน',
  'accounting:cost_allocation:read': 'ดูปันส่วนต้นทุน',
  'accounting:cost_allocation:write': 'สร้าง/แก้ไขปันส่วนต้นทุน',
  'accounting:fixed_assets:read': 'ดูสินทรัพย์ถาวร',
  'accounting:fixed_assets:write': 'สร้าง/แก้ไขสินทรัพย์ถาวร',
  'accounting:asset_categories:read': 'ดูหมวดสินทรัพย์',
  'accounting:asset_categories:write': 'สร้าง/แก้ไขหมวดสินทรัพย์',
  'accounting:equipment:read': 'ดูอุปกรณ์',
  'accounting:equipment:write': 'สร้าง/แก้ไขอุปกรณ์',
  'accounting:maintenance:read': 'ดูบำรุงรักษา',
  'accounting:maintenance:write': 'บันทึกบำรุงรักษา',
  'accounting:reports:read': 'ดูรายงานบัญชี',
  'cost:read': 'ดูต้นทุน',
  'cost:write': 'สร้าง/แก้ไขต้นทุน',
  'admin:read': 'ดูตั้งค่า Admin',
  'admin:write': 'แก้ไขตั้งค่า Admin',
};

// Module-to-URL mapping for Sheet 3
const MODULE_URLS: { module: string; moduleTh: string; url: string; permRead: string; permWrite: string; permSpecial: string }[] = [
  { module: 'Users', moduleTh: 'จัดการผู้ใช้', url: '/users', permRead: 'users:read', permWrite: 'users:write', permSpecial: 'users:delete' },
  { module: 'Items', moduleTh: 'สินค้า/วัตถุดิบ', url: '/items', permRead: 'items:read', permWrite: 'items:write', permSpecial: 'items:delete' },
  { module: 'Inventory', moduleTh: 'คลังสินค้า', url: '/inventory', permRead: 'inventory:read', permWrite: 'inventory:write', permSpecial: 'inventory:adjust' },
  { module: 'Production', moduleTh: 'การผลิต', url: '/production', permRead: 'production:read', permWrite: 'production:write', permSpecial: 'production:approve' },
  { module: 'Quality', moduleTh: 'ควบคุมคุณภาพ', url: '/quality', permRead: 'quality:read', permWrite: 'quality:write', permSpecial: 'quality:approve' },
  { module: 'Purchasing', moduleTh: 'จัดซื้อ', url: '/purchasing', permRead: 'purchasing:read', permWrite: 'purchasing:write', permSpecial: 'purchasing:approve' },
  { module: 'Sales', moduleTh: 'ขาย', url: '/sales', permRead: 'sales:read', permWrite: 'sales:write', permSpecial: 'sales:approve' },
  { module: 'HR', moduleTh: 'บุคลากร', url: '/hr', permRead: 'hr:read', permWrite: 'hr:write', permSpecial: 'hr:admin' },
  { module: 'Accounting', moduleTh: 'บัญชี', url: '/accounting', permRead: 'accounting:gl_accounts:read', permWrite: 'accounting:gl_accounts:write', permSpecial: 'accounting:journal_entries:reverse' },
  { module: 'Cost', moduleTh: 'ต้นทุน', url: '/cost', permRead: 'cost:read', permWrite: 'cost:write', permSpecial: '' },
  { module: 'CAPA', moduleTh: 'CAPA', url: '/capa', permRead: 'capa:read', permWrite: 'capa:write', permSpecial: 'capa:close' },
  { module: 'Complaints', moduleTh: 'เรื่องร้องเรียน', url: '/complaints', permRead: 'complaints:read', permWrite: 'complaints:write', permSpecial: 'complaints:close' },
  { module: 'Recalls', moduleTh: 'เรียกคืน', url: '/recalls', permRead: 'recalls:read', permWrite: 'recalls:write', permSpecial: 'recalls:close' },
  { module: 'Documents', moduleTh: 'เอกสาร GMP', url: '/documents', permRead: 'documents:read', permWrite: 'documents:write', permSpecial: 'documents:approve' },
  { module: 'Stability', moduleTh: 'Stability', url: '/stability', permRead: 'stability:read', permWrite: 'stability:write', permSpecial: 'stability:approve' },
  { module: 'Sanitation', moduleTh: 'สุขาภิบาล', url: '/sanitation', permRead: 'sanitation:read', permWrite: 'sanitation:write', permSpecial: 'sanitation:verify' },
  { module: 'Internal Audit', moduleTh: 'ตรวจสอบภายใน', url: '/internal-audit', permRead: 'audit:read', permWrite: 'audit:write', permSpecial: 'audit:approve' },
  { module: 'PQR', moduleTh: 'Product Quality Review', url: '/pqr', permRead: 'pqr:read', permWrite: 'pqr:write', permSpecial: 'pqr:approve' },
  { module: 'Change Control', moduleTh: 'Change Control', url: '/changes', permRead: 'change_control:read', permWrite: 'change_control:write', permSpecial: 'change_control:approve' },
  { module: 'Issues', moduleTh: 'แจ้งปัญหา', url: '/issues', permRead: 'issues:read', permWrite: 'issues:write', permSpecial: 'issues:assign' },
  { module: 'VMI Portal', moduleTh: 'VMI Portal', url: '/settings/vmi', permRead: 'vmi-settings:read', permWrite: 'vmi-settings:write', permSpecial: 'vmi-sync:execute' },
  { module: 'Reports', moduleTh: 'รายงาน', url: '/reports', permRead: 'reports:read', permWrite: '', permSpecial: 'reports:export' },
  { module: 'Settings', moduleTh: 'ตั้งค่าระบบ', url: '/admin/settings', permRead: 'settings:read', permWrite: 'settings:write', permSpecial: '' },
];

// ===== STYLES =====

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const GROUP_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
const GROUP_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: 'FF1F4E79' } };
const CHECK_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF2E7D32' }, size: 12, bold: true };
const CROSS_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFCCCCCC' }, size: 10 };
const WARN_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
const ERROR_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
};

// ===== HELPERS =====

function hasRole(permission: string, role: string): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

function getRoleLabelTh(role: string): string {
  const found = ROLES_IN_DROPDOWN.find(r => r.value === role);
  if (found) return found.labelTh;
  const extras: Record<string, string> = {
    finance: 'การเงิน', accountant: 'นักบัญชี',
    hr_admin: 'ผู้ดูแล HR', hr_staff: 'เจ้าหน้าที่ HR',
    health_staff: 'เจ้าหน้าที่สุขภาพ',
  };
  return extras[role] || role;
}

// ===== BUILD WORKBOOK =====

async function generate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Herbal Medicine ERP';
  wb.created = new Date();

  // =============================================
  // SHEET 1: สรุปบทบาท (Role Summary)
  // =============================================
  const ws1 = wb.addWorksheet('สรุปบทบาท', { properties: { defaultColWidth: 18 } });

  // Title
  ws1.mergeCells('A1:F1');
  const titleCell1 = ws1.getCell('A1');
  titleCell1.value = 'สรุปบทบาทผู้ใช้ระบบ Herbal Medicine ERP';
  titleCell1.font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
  titleCell1.alignment = { horizontal: 'center' };

  ws1.mergeCells('A2:F2');
  ws1.getCell('A2').value = `สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  ws1.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
  ws1.getCell('A2').alignment = { horizontal: 'center' };

  // Headers
  const headers1 = ['#', 'Role Code', 'ชื่อบทบาท (ไทย)', 'ชื่อบทบาท (อังกฤษ)', 'จำนวนสิทธิ์', 'หมายเหตุ'];
  ws1.columns = [
    { width: 5 }, { width: 15 }, { width: 22 }, { width: 25 }, { width: 14 }, { width: 50 },
  ];
  const headerRow1 = ws1.addRow(headers1);
  headerRow1.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
  });
  headerRow1.height = 24;

  // Data rows
  ROLES_IN_DROPDOWN.forEach((role, idx) => {
    const permCount = Object.values(PERMISSIONS).filter(roles => roles.includes(role.value)).length;
    let remark = '';
    if (role.value === 'accounting') {
      remark = '⚠ ไม่มีใน PERMISSIONS — ผู้ใช้จะเข้าโมดูลไม่ได้ ควรใช้ finance หรือ accountant แทน';
    } else if (role.value === 'admin') {
      remark = 'เข้าถึงทุกฟังก์ชัน';
    } else if (role.value === 'user') {
      remark = 'เข้าได้เฉพาะ Issues เท่านั้น';
    }

    const row = ws1.addRow([idx + 1, role.value, role.labelTh, role.labelEn, permCount, remark]);
    row.eachCell(cell => { cell.border = THIN_BORDER; });
    row.getCell(5).alignment = { horizontal: 'center' };
    if (role.value === 'accounting') {
      row.eachCell(cell => { cell.fill = ERROR_FILL; });
    }
  });

  // Extra roles not in dropdown
  ws1.addRow([]);
  const extraTitle = ws1.addRow(['', '', 'บทบาทในระบบที่ไม่อยู่ใน Dropdown', '', '', '']);
  extraTitle.getCell(3).font = { bold: true, size: 11, color: { argb: 'FFB71C1C' } };
  const extraRoles = [
    { value: 'finance', labelTh: 'การเงิน', note: 'มีสิทธิ์บัญชีเต็ม — ไม่มีใน User dropdown' },
    { value: 'accountant', labelTh: 'นักบัญชี', note: 'มีสิทธิ์บัญชี (ไม่รวมลบ/กลับรายการ) — ไม่มีใน User dropdown' },
    { value: 'hr_admin', labelTh: 'ผู้ดูแล HR', note: 'สิทธิ์ HR Admin — ไม่มีใน User dropdown' },
    { value: 'hr_staff', labelTh: 'เจ้าหน้าที่ HR', note: 'สิทธิ์ HR อ่าน/เขียน — ไม่มีใน User dropdown' },
    { value: 'health_staff', labelTh: 'เจ้าหน้าที่สุขภาพ', note: 'สิทธิ์ Health Records — ไม่มีใน User dropdown' },
  ];
  extraRoles.forEach((r, idx) => {
    const permCount = Object.values(PERMISSIONS).filter(roles => roles.includes(r.value)).length;
    const row = ws1.addRow([ROLES_IN_DROPDOWN.length + idx + 1, r.value, r.labelTh, '', permCount, r.note]);
    row.eachCell(cell => { cell.border = THIN_BORDER; cell.fill = WARN_FILL; });
  });

  // =============================================
  // SHEET 2: Permission Matrix (Full)
  // =============================================
  const ws2 = wb.addWorksheet('Permission Matrix', { properties: { defaultColWidth: 12 } });

  // Title
  ws2.mergeCells('A1:R1');
  ws2.getCell('A1').value = 'ตารางสิทธิ์การเข้าถึง (Permission Matrix)';
  ws2.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
  ws2.getCell('A1').alignment = { horizontal: 'center' };

  ws2.mergeCells('A2:R2');
  ws2.getCell('A2').value = '✓ = มีสิทธิ์  |  — = ไม่มีสิทธิ์  |  บทบาทที่ highlight เหลืองไม่มีใน User dropdown';
  ws2.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
  ws2.getCell('A2').alignment = { horizontal: 'center' };

  // Column widths
  ws2.getColumn(1).width = 30; // Group
  ws2.getColumn(2).width = 35; // Permission
  ws2.getColumn(3).width = 30; // Description

  // Headers
  const matrixHeaders = ['โมดูล', 'Permission Code', 'คำอธิบาย', ...ROLE_COLUMNS.map(r => getRoleLabelTh(r))];
  const headerRow2 = ws2.addRow(matrixHeaders);
  headerRow2.height = 30;
  headerRow2.eachCell((cell, colNum) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
    // Highlight extra-role columns
    if (colNum > 3) {
      const roleIdx = colNum - 4;
      const role = ROLE_COLUMNS[roleIdx];
      if (['finance', 'accountant', 'hr_admin', 'hr_staff', 'health_staff'].includes(role)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B6914' } };
      }
      if (role === 'accounting') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB71C1C' } };
      }
    }
  });

  // Data rows by group
  for (const group of PERMISSION_GROUPS) {
    // Group header row
    const groupRow = ws2.addRow([`${group.groupTh} (${group.group})`, '', '', ...ROLE_COLUMNS.map(() => '')]);
    ws2.mergeCells(groupRow.number, 1, groupRow.number, 3);
    groupRow.eachCell(cell => {
      cell.fill = GROUP_FILL;
      cell.font = GROUP_FONT;
      cell.border = THIN_BORDER;
    });

    for (const perm of group.permissions) {
      const rowData = [
        '',
        perm,
        PERMISSION_LABELS[perm] || perm,
        ...ROLE_COLUMNS.map(role => hasRole(perm, role) ? '✓' : '—'),
      ];
      const dataRow = ws2.addRow(rowData);
      dataRow.eachCell((cell, colNum) => {
        cell.border = THIN_BORDER;
        cell.alignment = { horizontal: colNum > 3 ? 'center' : 'left', vertical: 'middle' };
        if (colNum > 3) {
          cell.font = cell.value === '✓' ? CHECK_FONT : CROSS_FONT;
        }
        // Highlight accounting column (role that doesn't work)
        const roleIdx = colNum - 4;
        if (colNum > 3 && ROLE_COLUMNS[roleIdx] === 'accounting') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
        }
      });
    }
  }

  // =============================================
  // SHEET 3: หน้าจอแยกตามบทบาท (Screen Access by Role)
  // =============================================
  const ws3 = wb.addWorksheet('หน้าจอแยกตามบทบาท', { properties: { defaultColWidth: 14 } });

  ws3.mergeCells('A1:N1');
  ws3.getCell('A1').value = 'สิทธิ์การเข้าถึงหน้าจอ แยกตามบทบาท';
  ws3.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
  ws3.getCell('A1').alignment = { horizontal: 'center' };

  ws3.mergeCells('A2:N2');
  ws3.getCell('A2').value = '✓ ดู = ดูข้อมูล  |  ✓ แก้ไข = สร้าง/แก้ไข  |  ✓ พิเศษ = อนุมัติ/ลบ/ปิด  |  ✗ = ไม่มีสิทธิ์';
  ws3.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
  ws3.getCell('A2').alignment = { horizontal: 'center' };

  ws3.getColumn(1).width = 22;
  ws3.getColumn(2).width = 20;
  ws3.getColumn(3).width = 22;

  const dropdownRoles = ROLES_IN_DROPDOWN.map(r => r.value);

  const screenHeaders = ['โมดูล', 'ชื่อไทย', 'URL', ...dropdownRoles.map(r => getRoleLabelTh(r))];
  const headerRow3 = ws3.addRow(screenHeaders);
  headerRow3.height = 28;
  headerRow3.eachCell((cell, colNum) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
    if (colNum > 3) {
      const roleIdx = colNum - 4;
      if (dropdownRoles[roleIdx] === 'accounting') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB71C1C' } };
      }
    }
  });

  for (const mod of MODULE_URLS) {
    const rowData: (string)[] = [mod.module, mod.moduleTh, mod.url];
    for (const role of dropdownRoles) {
      const canRead = mod.permRead ? hasRole(mod.permRead, role) : false;
      const canWrite = mod.permWrite ? hasRole(mod.permWrite, role) : false;
      const canSpecial = mod.permSpecial ? hasRole(mod.permSpecial, role) : false;

      if (canSpecial && canWrite && canRead) {
        rowData.push('✓ ดู/แก้ไข/พิเศษ');
      } else if (canWrite && canRead) {
        rowData.push('✓ ดู/แก้ไข');
      } else if (canRead) {
        rowData.push('✓ ดูเท่านั้น');
      } else {
        rowData.push('✗');
      }
    }

    const row = ws3.addRow(rowData);
    row.eachCell((cell, colNum) => {
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: colNum > 3 ? 'center' : 'left', vertical: 'middle', wrapText: true };
      if (colNum > 3) {
        const val = String(cell.value);
        if (val.startsWith('✓')) {
          cell.font = { color: { argb: 'FF2E7D32' }, size: 10 };
          if (val.includes('พิเศษ')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            cell.font = { color: { argb: 'FF1B5E20' }, bold: true, size: 10 };
          }
        } else {
          cell.font = CROSS_FONT;
        }
        const roleIdx = colNum - 4;
        if (dropdownRoles[roleIdx] === 'accounting') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
        }
      }
    });
  }

  // =============================================
  // SHEET 4: ปัญหาที่พบ (Issues)
  // =============================================
  const ws4 = wb.addWorksheet('ปัญหาที่พบ', { properties: { defaultColWidth: 25 } });

  ws4.mergeCells('A1:D1');
  ws4.getCell('A1').value = 'ปัญหาและข้อเสนอแนะ';
  ws4.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFB71C1C' } };
  ws4.getCell('A1').alignment = { horizontal: 'center' };

  ws4.getColumn(1).width = 8;
  ws4.getColumn(2).width = 30;
  ws4.getColumn(3).width = 55;
  ws4.getColumn(4).width = 55;

  const issueHeaders = ['#', 'ปัญหา', 'รายละเอียด', 'ข้อเสนอแนะ'];
  const headerRow4 = ws4.addRow(issueHeaders);
  headerRow4.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB71C1C' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
  });
  headerRow4.height = 24;

  const issues = [
    {
      title: 'Role "accounting" ไม่ทำงาน',
      detail: 'Dropdown มี "ฝ่ายบัญชี" (accounting) แต่ในระบบ PERMISSIONS ใช้ "finance" และ "accountant" — ผู้ใช้ที่ถูกกำหนดเป็น accounting จะไม่มีสิทธิ์เข้าโมดูลใดเลย',
      suggestion: 'เปลี่ยน dropdown ให้ใช้ "finance" หรือ "accountant" แทน หรือเพิ่ม "accounting" ในตาราง PERMISSIONS',
    },
    {
      title: 'Role ที่ขาดหายจาก Dropdown',
      detail: 'finance, accountant, hr_admin, hr_staff, health_staff มีอยู่ในระบบ PERMISSIONS แต่ไม่มีใน dropdown หน้า User — ไม่สามารถกำหนดให้ผู้ใช้ได้',
      suggestion: 'เพิ่ม role เหล่านี้ใน dropdown ของหน้า /users/new และ /users/[id]',
    },
    {
      title: 'Accounting API ไม่มี Permission Check',
      detail: 'API routes ของโมดูลบัญชี (~80 routes) ใช้แค่ getSession() ไม่ได้ตรวจ permission — ทุก role ที่ login ได้จะเข้าถึง Accounting ได้ทั้งหมด',
      suggestion: 'เพิ่ม withAuth() พร้อม permission check ในทุก Accounting API route',
    },
    {
      title: 'Sidebar ไม่ซ่อนตามสิทธิ์',
      detail: 'เมนูด้านซ้ายแสดงทุกโมดูลเหมือนกันไม่ว่า role ใด — ผู้ใช้เห็นเมนูทั้งหมดแต่ถูกบล็อกที่ API',
      suggestion: 'เพิ่ม role-based menu filtering ใน Sidebar component ให้แสดงเฉพาะเมนูที่มีสิทธิ์',
    },
    {
      title: 'App Roles (HR) ยังไม่เชื่อมต่อ',
      detail: 'ระบบ App Roles ในหน้า /hr/roles กำหนดสิทธิ์ได้ แต่ไม่ได้ถูกนำไปใช้ enforce จริง — ระบบใช้ Legacy RBAC จาก user.role เท่านั้น',
      suggestion: 'เชื่อมต่อ App Roles กับ withAuth() middleware หรือสร้าง permission resolver ใหม่',
    },
  ];

  issues.forEach((issue, idx) => {
    const row = ws4.addRow([idx + 1, issue.title, issue.detail, issue.suggestion]);
    row.eachCell(cell => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
    row.height = 50;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // =============================================
  // SAVE
  // =============================================
  const outputPath = path.join(process.cwd(), 'docs', 'User-Role-Permission-Report.xlsx');
  await wb.xlsx.writeFile(outputPath);
  console.log(`Report saved to: ${outputPath}`);
}

generate().catch(console.error);
