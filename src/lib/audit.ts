import { getDb, isSqlite, schema } from './db';

export interface AuditLogEntry {
  userId?: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT' | 'RESERVE' | 'ISSUE' | 'RECEIVE' | 'TRANSFER' | 'ADJUST' | 'RELEASE' | 'BLOCK' | 'SYNC' | 'PERIOD_CLOSE' | 'PERIOD_SOFT_CLOSE' | 'PERIOD_REOPEN' | 'YEAR_CLOSE' | 'OPENING_BALANCES_CREATED' | 'CONFIRM' | 'SHIP';
  tableName?: string;
  recordId?: number;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  // Additional properties for accounting module
  entity?: string;
  entityId?: number;
  details?: string;
}

/**
 * Try to resolve the current user's ID from the session cookie.
 * This only works inside a Next.js request context (API routes, server components).
 * Returns undefined silently if not in a request context or no session exists.
 */
async function resolveSessionUserId(): Promise<number | undefined> {
  try {
    // Dynamic import to avoid circular dependency and to allow
    // graceful failure outside request context
    const { getSession } = await import('./auth');
    const session = await getSession();
    return session?.userId;
  } catch {
    // Not in a request context (e.g., seed scripts, tests) — silently ignore
    return undefined;
  }
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Auto-detect userId from session when not explicitly provided
    const userId = entry.userId ?? (await resolveSessionUserId());

    const db = await getDb();
    const auditTable = isSqlite() ? schema.sqliteAuditTrail : schema.mysqlAuditTrail;

    await (db as any).insert(auditTable).values({
      userId,
      action: entry.action,
      tableName: entry.tableName,
      recordId: entry.recordId,
      oldValue: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
      newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
      ipAddress: entry.ipAddress,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}
