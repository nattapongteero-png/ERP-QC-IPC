/**
 * Database Helper
 * 
 * Simple, practical wrapper to handle SQLite/MySQL Drizzle ORM differences
 * without requiring 'as any' casts in every API route.
 */

import { getDb, isSqlite } from './index';
import * as schema from './schema';
import type { SQL } from 'drizzle-orm';

// Re-export isSqlite for convenience
export { isSqlite };

/**
 * Detect a foreign-key constraint violation across MySQL and SQLite.
 * MySQL surfaces errno 1451 / code ER_ROW_IS_REFERENCED_2; SQLite throws a
 * message containing "FOREIGN KEY constraint failed".
 */
export function isForeignKeyError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { errno?: number; code?: string; message?: string };
  if (e.errno === 1451 || e.errno === 1452) return true;
  if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_NO_REFERENCED_ROW_2') return true;
  if (e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || e.code === 'SQLITE_CONSTRAINT') return true;
  const msg = String(e.message ?? error).toLowerCase();
  return msg.includes('foreign key constraint') || msg.includes('foreign key constraint failed');
}

/**
 * Get table reference based on database type
 */
export function getTableRef(tableName: string): any {
  const usingSqlite = isSqlite();
  const sqliteTableName = `sqlite${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`;
  const mysqlTableName = `mysql${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`;
  
  const sqliteTable = (schema as any)[sqliteTableName];
  const mysqlTable = (schema as any)[mysqlTableName];
  
  if (!sqliteTable || !mysqlTable) {
    throw new Error(`Table ${tableName} not found in schema (looked for ${sqliteTableName} and ${mysqlTableName})`);
  }
  
  return usingSqlite ? sqliteTable : mysqlTable;
}

/**
 * Format date appropriately for current database
 */
export function dbDate(date: Date = new Date()): string | Date {
  return isSqlite() ? date.toISOString() : date;
}

/**
 * Parse a date string for database storage
 * SQLite uses ISO strings, MySQL uses Date objects
 */
export function parseDbDate(dateStr: string | null | undefined): string | Date | null {
  if (!dateStr) return null;
  return isSqlite() ? dateStr : new Date(dateStr);
}

/**
 * Extract the inserted ID from an insert result
 * Handles the difference between SQLite (lastInsertRowid) and MySQL (insertId)
 */
export function getInsertId(result: unknown): number {
  if (isSqlite()) {
    return Number((result as { lastInsertRowid: number | bigint }).lastInsertRowid);
  }
  return Number((result as unknown as [{ insertId: number }])[0].insertId);
}

/**
 * Extract the affected row count from an UPDATE/DELETE result
 * Handles the difference between SQLite (changes) and MySQL (affectedRows)
 *
 * Use this to detect optimistic-lock failures, e.g. UPDATE ... WHERE status='requested'
 * returning 0 affected rows means another caller changed the status first.
 */
export function getAffectedRows(result: unknown): number {
  if (isSqlite()) {
    const r = result as { changes?: number } | undefined;
    return Number(r?.changes ?? 0);
  }
  const r = result as [{ affectedRows?: number }] | { affectedRows?: number } | undefined;
  if (Array.isArray(r)) {
    return Number(r[0]?.affectedRows ?? 0);
  }
  return Number((r as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/**
 * Execute a database operation with proper type handling
 */
export async function executeDbOperation<T = any>(
  operation: (db: any) => Promise<T>
): Promise<T> {
  const db = await getDb();
  return operation(db);
}

/**
 * Common database operation patterns
 */
export const dbOperations = {
  /**
   * Select records from a table
   */
  async select<T = any>(config: {
    table: string;
    columns?: Record<string, any>;
    where?: SQL;
    orderBy?: any;
    limit?: number;
    offset?: number;
    joins?: Array<{
      type: 'innerJoin' | 'leftJoin' | 'rightJoin';
      table: string;
      on: SQL;
    }>;
  }): Promise<T[]> {
    return executeDbOperation(async (db) => {
      const table = getTableRef(config.table);
      let query = db.select(config.columns || {}).from(table);
      
      // Apply joins
      if (config.joins) {
        for (const join of config.joins) {
          const joinTable = getTableRef(join.table);
          query = query[join.type](joinTable, join.on);
        }
      }
      
      if (config.where) {
        query = query.where(config.where);
      }
      
      if (config.orderBy) {
        query = query.orderBy(config.orderBy);
      }
      
      if (config.limit !== undefined) {
        query = query.limit(config.limit);
        if (config.offset !== undefined) {
          query = query.offset(config.offset);
        }
      }
      
      return query;
    });
  },

  /**
   * Select a single record
   */
  async selectOne<T = any>(config: {
    table: string;
    columns?: Record<string, any>;
    where: SQL;
  }): Promise<T | null> {
    const results = await dbOperations.select<T>({
      ...config,
      limit: 1,
    });
    return results[0] || null;
  },

  /**
   * Select by ID
   */
  async selectById<T = any>(
    table: string,
    id: number,
    columns?: Record<string, any>
  ): Promise<T | null> {
    const { eq } = await import('drizzle-orm');
    const tableRef = getTableRef(table);
    return dbOperations.selectOne<T>({
      table,
      columns,
      where: eq(tableRef.id, id),
    });
  },

  /**
   * Insert a record
   */
  async insert(config: {
    table: string;
    data: Record<string, any>;
  }): Promise<any> {
    return executeDbOperation(async (db) => {
      const table = getTableRef(config.table);
      return db.insert(table).values(config.data);
    });
  },

  /**
   * Update records
   */
  async update(config: {
    table: string;
    data: Record<string, any>;
    where: SQL;
  }): Promise<any> {
    return executeDbOperation(async (db) => {
      const table = getTableRef(config.table);
      return db.update(table).set(config.data).where(config.where);
    });
  },

  /**
   * Update by ID
   */
  async updateById(
    table: string,
    id: number,
    data: Record<string, any>
  ): Promise<any> {
    const { eq } = await import('drizzle-orm');
    const tableRef = getTableRef(table);
    return dbOperations.update({
      table,
      data,
      where: eq(tableRef.id, id),
    });
  },

  /**
   * Delete records
   */
  async delete(config: {
    table: string;
    where: SQL;
  }): Promise<any> {
    return executeDbOperation(async (db) => {
      const table = getTableRef(config.table);
      return db.delete(table).where(config.where);
    });
  },

  /**
   * Delete by ID
   */
  async deleteById(
    table: string,
    id: number
  ): Promise<any> {
    const { eq } = await import('drizzle-orm');
    const tableRef = getTableRef(table);
    return dbOperations.delete({
      table,
      where: eq(tableRef.id, id),
    });
  },

  /**
   * Delete a record, or soft-disable it if it is referenced elsewhere.
   *
   * Master-data policy: "ไม่เคยใช้ → ลบได้ / เคยใช้ → ปิดการใช้งานเท่านั้น".
   * We try a real DELETE first; if the database rejects it with a foreign-key
   * constraint violation (MySQL errno 1451 / SQLite "FOREIGN KEY constraint
   * failed"), the row is in use, so we fall back to setting `isActive=false`.
   *
   * @returns `{ mode: 'deleted' }` when the row was removed, or
   *          `{ mode: 'disabled' }` when it was in use and got soft-disabled.
   * @throws  the original error for any non-FK failure (e.g. table has no
   *          `isActive` column, or an unrelated DB error).
   */
  async deleteOrDisableById(
    table: string,
    id: number,
    /** Extra columns to set on soft-disable (e.g. updatedAt, disabledBy). */
    disablePatch: Record<string, any> = {}
  ): Promise<{ mode: 'deleted' | 'disabled' }> {
    try {
      await dbOperations.deleteById(table, id);
      return { mode: 'deleted' };
    } catch (error) {
      if (!isForeignKeyError(error)) throw error;
      await dbOperations.updateById(table, id, { isActive: false, ...disablePatch });
      return { mode: 'disabled' };
    }
  },

  /**
   * Execute raw SQL
   */
  async execute(sql: SQL): Promise<any> {
    return executeDbOperation(async (db) => {
      return db.execute(sql);
    });
  },

  /**
   * Count records
   */
  async count(config: {
    table: string;
    where?: SQL;
  }): Promise<number> {
    const { count } = await import('drizzle-orm');
    
    const results = await dbOperations.select<{ count: number }>({
      table: config.table,
      columns: { count: count() },
      where: config.where,
    });
    
    return results[0]?.count || 0;
  },
};

/**
 * Shortcut for common operations
 */
export const db = dbOperations;