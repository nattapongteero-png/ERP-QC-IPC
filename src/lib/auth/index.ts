import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { expandRole } from './role-mapping';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    return null;
  }
  
  return verifyToken(token);
}

export async function setSession(payload: JWTPayload): Promise<void> {
  const token = generateToken(payload);
  const cookieStore = await cookies();
  
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

// Role-based access control
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  PRODUCTION: 'production',
  QC: 'qc',
  WAREHOUSE: 'warehouse',
  PURCHASING: 'purchasing',
  SALES: 'sales',
  USER: 'user',
  // HR roles
  HR: 'hr',
  HR_ADMIN: 'hr_admin',
  HR_STAFF: 'hr_staff',
  HEALTH_STAFF: 'health_staff',
  // Finance/Accounting roles
  FINANCE: 'finance',
  ACCOUNTANT: 'accountant',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const PERMISSIONS = {
  // User management
  'users:read': [ROLES.ADMIN, ROLES.MANAGER],
  'users:write': [ROLES.ADMIN],
  'users:delete': [ROLES.ADMIN],
  
  // Items/Products
  'items:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION, ROLES.QC, ROLES.WAREHOUSE, ROLES.PURCHASING, ROLES.SALES],
  'items:write': [ROLES.ADMIN, ROLES.MANAGER],
  'items:delete': [ROLES.ADMIN],
  
  // Inventory
  'inventory:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION, ROLES.QC, ROLES.WAREHOUSE],
  'inventory:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE],
  'inventory:adjust': [ROLES.ADMIN, ROLES.MANAGER],
  
  // Production
  'production:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION, ROLES.QC],
  'production:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION],
  'production:approve': [ROLES.ADMIN, ROLES.MANAGER],
  // Cleaning dual-control (GMP): cleaner (mark) must differ from verifier.
  // Record-level check (operator != verifier) in wo-execution.service enforces
  // the dual-control even when a user has both permissions (e.g. ADMIN).
  'production:clean_mark': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION],
  'production:clean_verify': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  
  // Quality
  'quality:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION, ROLES.QC],
  'quality:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'quality:approve': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  
  // Purchasing
  // `purchasing:read` is also used as a permission gate for master-data
  // lookup endpoints like GET /api/vendors. Production and QC staff need
  // to look up vendors for GMP traceability (which supplier produced the
  // material in the lot they are using/testing), so we include them here.
  // Write/approve stays restricted.
  'purchasing:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PURCHASING, ROLES.WAREHOUSE, ROLES.PRODUCTION, ROLES.QC],
  'purchasing:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PURCHASING],
  'purchasing:approve': [ROLES.ADMIN, ROLES.MANAGER],
  
  // Sales
  'sales:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES, ROLES.WAREHOUSE],
  'sales:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES],
  'sales:approve': [ROLES.ADMIN, ROLES.MANAGER],
  
  // Reports
  'reports:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.PRODUCTION, ROLES.QC, ROLES.WAREHOUSE, ROLES.PURCHASING, ROLES.SALES, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'reports:export': [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR],
  
  // Settings
  'settings:read': [ROLES.ADMIN, ROLES.MANAGER],
  'settings:write': [ROLES.ADMIN],

  // HR/Personnel Management
  'hr:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.HR_ADMIN, ROLES.HR_STAFF],
  'hr:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.HR_ADMIN, ROLES.HR_STAFF],
  'hr:admin': [ROLES.ADMIN, ROLES.HR, ROLES.HR_ADMIN],
  'hr:health_staff': [ROLES.ADMIN, ROLES.HR, ROLES.HR_ADMIN, ROLES.HEALTH_STAFF],

  // VMI Portal Integration (Vendor Side)
  // This system IS the vendor - syncs TO VMI portals, receives orders FROM portals
  'vmi-settings:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES],
  'vmi-settings:write': [ROLES.ADMIN, ROLES.MANAGER],
  'vmi-sync:execute': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES],
  'vmi-orders:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES, ROLES.WAREHOUSE],
  'vmi-orders:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES],

  // GMP Document Control (หมวด 5)
  'documents:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION],
  'documents:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'documents:approve': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // CAPA Management (หมวด 1)
  'capa:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION],
  'capa:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'capa:close': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // Complaint Management (หมวด 9)
  'complaints:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.SALES],
  'complaints:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.SALES],
  'complaints:investigate': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'complaints:close': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // Recall Management (หมวด 9)
  'recalls:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.SALES, ROLES.WAREHOUSE],
  'recalls:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'recalls:execute': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.WAREHOUSE],
  'recalls:close': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // Stability Program (หมวด 7.4)
  'stability:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION],
  'stability:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'stability:approve': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // Sanitation (หมวด 4)
  'sanitation:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION, ROLES.WAREHOUSE],
  'sanitation:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION],
  'sanitation:verify': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // Internal Audit (หมวด 10)
  'audit:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'audit:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'audit:approve': [ROLES.ADMIN, ROLES.MANAGER],

  // PQR - Product Quality Review (หมวด 1)
  'pqr:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION],
  'pqr:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'pqr:approve': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'pqr:delete': [ROLES.ADMIN, ROLES.MANAGER],

  // Change Control (หมวด 8)
  'change_control:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION],
  'change_control:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'change_control:approve': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],

  // Accounting Module - Chart of Accounts
  'accounting:gl_accounts:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:gl_accounts:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:gl_accounts:delete': [ROLES.ADMIN, ROLES.FINANCE],
  'accounting:gl_account_types:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:gl_account_types:write': [ROLES.ADMIN, ROLES.FINANCE],

  // Accounting Module - Journal Entries
  'accounting:journal_entries:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:journal_entries:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:journal_entries:post': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:journal_entries:reverse': [ROLES.ADMIN, ROLES.FINANCE],

  // Accounting Module - Fiscal Periods
  'accounting:fiscal_periods:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:fiscal_periods:write': [ROLES.ADMIN, ROLES.FINANCE],
  'accounting:fiscal_periods:close': [ROLES.ADMIN, ROLES.FINANCE],

  // Accounting Module - Accounts Payable
  'accounting:ap_invoices:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT, ROLES.PURCHASING],
  'accounting:ap_invoices:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:ap_invoices:approve': [ROLES.ADMIN, ROLES.FINANCE],
  'accounting:ap_invoices:pay': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],

  // Accounting Module - Accounts Receivable
  'accounting:ar_invoices:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT, ROLES.SALES],
  'accounting:ar_invoices:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:ar_invoices:confirm': [ROLES.ADMIN, ROLES.FINANCE],

  // Accounting Module - Payments
  'accounting:payments:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:payments:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],

  // Accounting Module - Cost Allocation
  'accounting:cost_allocation:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT, ROLES.PRODUCTION],
  'accounting:cost_allocation:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],

  // Accounting Module - Fixed Assets
  'accounting:fixed_assets:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:fixed_assets:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:asset_categories:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:asset_categories:write': [ROLES.ADMIN, ROLES.FINANCE],

  // Accounting Module - Equipment
  'accounting:equipment:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT, ROLES.PRODUCTION],
  'accounting:equipment:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.ACCOUNTANT],
  'accounting:maintenance:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.PRODUCTION],
  'accounting:maintenance:write': [ROLES.ADMIN, ROLES.FINANCE, ROLES.PRODUCTION],

  // Accounting Module - Reports
  'accounting:reports:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],

  // Cost Management (Feature: 014-unit-cost)
  'cost:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT, ROLES.PURCHASING, ROLES.PRODUCTION],
  'cost:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.ACCOUNTANT],

  // Admin/System Management (Feature: 014-unit-cost)
  'admin:read': [ROLES.ADMIN],
  'admin:write': [ROLES.ADMIN],

  // Issue Tracker
  'issues:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION, ROLES.USER],
  'issues:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC, ROLES.PRODUCTION, ROLES.USER],
  'issues:assign': [ROLES.ADMIN, ROLES.MANAGER],
  'issues:delete': [ROLES.ADMIN],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function isAdminRole(role: string): boolean {
  // Accept both the legacy lowercase 'admin' and HR role codes that expand
  // to 'admin' (e.g. "ADMIN", "METAHERB_FACTORY"). This keeps super-users
  // unrestricted regardless of whether their user.role was set from the
  // legacy dropdown or the HR Roles module.
  if (role === ROLES.ADMIN) return true;
  const expanded = expandRole(role);
  return expanded.includes('admin');
}

export function hasPermission(role: Role, permission: Permission): boolean {
  // Administrator bypasses all permission checks.
  if (isAdminRole(role)) return true;
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  // Expand the user's role so an HR code (e.g. "QC_ANALYST") matches legacy
  // allow-lists (["qc", ...]). Falls back to direct comparison for roles
  // that were already legacy (e.g. "qc", "manager").
  const expanded = expandRole(role);
  return expanded.some((r) => allowedRoles.includes(r));
}

export function checkPermissions(role: Role, permissions: Permission[]): boolean {
  // Administrator bypasses all permission checks
  if (isAdminRole(role as string)) return true;
  return permissions.every(permission => hasPermission(role, permission));
}
