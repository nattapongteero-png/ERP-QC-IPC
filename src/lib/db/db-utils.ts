/**
 * Database Utilities
 * 
 * Provides type-safe database operations that handle SQLite/MySQL differences
 * without requiring explicit 'as any' casts.
 */

import { getDb, isSqlite } from './index';
import * as schema from './schema';
import type { SQL } from 'drizzle-orm';

// Re-export for convenience
export { isSqlite };

/**
 * Get the appropriate table based on database type
 */
export function getTable<T extends keyof typeof schema>(tableName: T): any {
  const usingSqlite = isSqlite();
  const capitalized = tableName.charAt(0).toUpperCase() + tableName.slice(1);
  const sqliteTable = (schema as any)[`sqlite${capitalized}`];
  const mysqlTable = (schema as any)[`mysql${capitalized}`];
  
  if (!sqliteTable || !mysqlTable) {
    throw new Error(`Table ${tableName} not found in schema`);
  }
  
  return usingSqlite ? sqliteTable : mysqlTable;
}

/**
 * Type-safe database query executor
 */
export class DbQuery {
  private db: any;

  private constructor(db: any) {
    this.db = db;
  }

  /**
   * Create a new DbQuery instance
   */
  static async create(): Promise<DbQuery> {
    const db = await getDb();
    return new DbQuery(db);
  }

  /**
   * Execute a SELECT query
   */
  async select(config: {
    from: any;
    columns?: Record<string, any>;
    where?: SQL;
    orderBy?: any;
    limit?: number;
    offset?: number;
    joins?: Array<{
      type: 'innerJoin' | 'leftJoin' | 'rightJoin';
      table: any;
      on: any;
    }>;
  }): Promise<any[]> {
    let query = this.db.select(config.columns || {}).from(config.from);

    // Apply joins
    if (config.joins) {
      for (const join of config.joins) {
        query = query[join.type](join.table, join.on);
      }
    }

    // Apply where clause
    if (config.where) {
      query = query.where(config.where);
    }

    // Apply order by
    if (config.orderBy) {
      query = query.orderBy(config.orderBy);
    }

    // Apply limit and offset
    if (config.limit !== undefined) {
      query = query.limit(config.limit);
      if (config.offset !== undefined) {
        query = query.offset(config.offset);
      }
    }

    return query;
  }

  /**
   * Execute an INSERT query
   */
  async insert(config: {
    into: any;
    values: Record<string, any> | Record<string, any>[];
  }): Promise<any> {
    const query = this.db.insert(config.into).values(config.values);
    return query;
  }

  /**
   * Execute an UPDATE query
   */
  async update(config: {
    table: any;
    set: Record<string, any>;
    where: SQL;
  }): Promise<any> {
    const query = this.db.update(config.table).set(config.set).where(config.where);
    return query;
  }

  /**
   * Execute a DELETE query
   */
  async delete(config: {
    from: any;
    where: SQL;
  }): Promise<any> {
    const query = this.db.delete(config.from).where(config.where);
    return query;
  }

  /**
   * Execute a raw SQL query
   */
  async execute(sql: SQL): Promise<any> {
    return this.db.execute(sql);
  }
}

/**
 * Convenience function to create a type-safe database query
 */
export async function db(): Promise<{
  select: DbQuery['select'];
  insert: DbQuery['insert'];
  update: DbQuery['update'];
  delete: DbQuery['delete'];
  execute: DbQuery['execute'];
}> {
  const dbQuery = await DbQuery.create();
  return {
    select: dbQuery.select.bind(dbQuery),
    insert: dbQuery.insert.bind(dbQuery),
    update: dbQuery.update.bind(dbQuery),
    delete: dbQuery.delete.bind(dbQuery),
    execute: dbQuery.execute.bind(dbQuery),
  };
}

/**
 * Format date for current database type
 */
export function formatDate(date: Date = new Date()): string | Date {
  return isSqlite() ? date.toISOString() : date;
}

/**
 * Helper to create common query patterns
 */
export const queryHelpers = {
  /**
   * Find a single record by ID
   */
  async findById<T = any>(tableName: keyof typeof schema, id: number): Promise<T | null> {
    const dbQuery = await DbQuery.create();
    const table = getTable(tableName);
    const results = await dbQuery.select({
      from: table,
      where: (await import('drizzle-orm')).eq(table.id, id),
      limit: 1,
    });
    return results[0] || null;
  },

  /**
   * Find all records with optional filtering
   */
  async findAll<T = any>(
    tableName: keyof typeof schema,
    options: {
      where?: SQL;
      orderBy?: any;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<T[]> {
    const dbQuery = await DbQuery.create();
    const table = getTable(tableName);
    return dbQuery.select({
      from: table,
      where: options.where,
      orderBy: options.orderBy,
      limit: options.limit,
      offset: options.offset,
    });
  },

  /**
   * Create a new record
   */
  async create(
    tableName: keyof typeof schema,
    data: Record<string, any>
  ): Promise<any> {
    const dbQuery = await DbQuery.create();
    const table = getTable(tableName);
    return dbQuery.insert({
      into: table,
      values: data,
    });
  },

  /**
   * Update a record by ID
   */
  async updateById(
    tableName: keyof typeof schema,
    id: number,
    data: Record<string, any>
  ): Promise<any> {
    const dbQuery = await DbQuery.create();
    const table = getTable(tableName);
    return dbQuery.update({
      table,
      set: data,
      where: (await import('drizzle-orm')).eq(table.id, id),
    });
  },

  /**
   * Delete a record by ID
   */
  async deleteById(
    tableName: keyof typeof schema,
    id: number
  ): Promise<any> {
    const dbQuery = await DbQuery.create();
    const table = getTable(tableName);
    return dbQuery.delete({
      from: table,
      where: (await import('drizzle-orm')).eq(table.id, id),
    });
  },
};