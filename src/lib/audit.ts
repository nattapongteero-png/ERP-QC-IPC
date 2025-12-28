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

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const db = await getDb();
    const auditTable = isSqlite() ? schema.sqliteAuditTrail : schema.mysqlAuditTrail;

    await (db as any).insert(auditTable).values({
      userId: entry.userId,
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
