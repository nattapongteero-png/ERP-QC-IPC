import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

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
  
  // Quality
  'quality:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION, ROLES.QC],
  'quality:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  'quality:approve': [ROLES.ADMIN, ROLES.MANAGER, ROLES.QC],
  
  // Purchasing
  'purchasing:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PURCHASING, ROLES.WAREHOUSE],
  'purchasing:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.PURCHASING],
  'purchasing:approve': [ROLES.ADMIN, ROLES.MANAGER],
  
  // Sales
  'sales:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES, ROLES.WAREHOUSE],
  'sales:write': [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES],
  'sales:approve': [ROLES.ADMIN, ROLES.MANAGER],
  
  // Reports
  'reports:read': [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR],
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
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(role as any);
}

export function checkPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}
