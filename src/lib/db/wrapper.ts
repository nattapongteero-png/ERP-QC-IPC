/**
 * Database Abstraction Layer
 * 
 * Provides a unified interface for SQLite and MySQL operations
 * to handle Drizzle ORM type incompatibilities.
 */

import { getDb, isSqlite } from './index';
import * as schema from './schema';
import { eq, and, or, desc, asc, gte, lte, like, isNull, isNotNull, sql, count, sum, avg, max, min } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// Re-export Drizzle helpers for convenience
export { eq, and, or, desc, asc, gte, lte, like, isNull, isNotNull, sql, count, sum, avg, max, min };

// Type definitions
export type Table = any; // Simplified type for tables
export type WhereClause = SQL | undefined;
export type SelectConfig = Record<string, any>;
export type OrderByConfig = any;
export type JoinConfig = any;

/**
 * Database operation result types
 */
export interface QueryResult<T = any> {
  data: T[];
  count?: number;
}

export interface SingleResult<T = any> {
  data: T | null;
}

export interface InsertResult {
  id: number;
  [key: string]: any;
}

export interface UpdateResult {
  affectedRows: number;
}

export interface DeleteResult {
  affectedRows: number;
}

/**
 * Database operation options
 */
export interface SelectOptions {
  where?: WhereClause;
  orderBy?: OrderByConfig;
  limit?: number;
  offset?: number;
  joins?: JoinConfig[];
}

export interface InsertOptions {
  returning?: string[];
}

export interface UpdateOptions {
  where: WhereClause;
  returning?: string[];
}

export interface DeleteOptions {
  where: WhereClause;
  returning?: string[];
}

/**
 * Database Wrapper Class
 * 
 * Provides a unified API for database operations that works with both
 * SQLite and MySQL Drizzle instances.
 */
export class DatabaseWrapper {
  private db: any;
  private usingSqlite: boolean;

  private constructor(db: any, usingSqlite: boolean) {
    this.db = db;
    this.usingSqlite = usingSqlite;
  }

  /**
   * Create a new DatabaseWrapper instance
   */
  static async create(): Promise<DatabaseWrapper> {
    const db = await getDb();
    const usingSqlite = isSqlite();
    return new DatabaseWrapper(db, usingSqlite);
  }

  /**
   * Get the appropriate table based on database type
   */
  getTable(tableName: keyof typeof schema): Table {
    const sqliteTable = (schema as any)[`sqlite${this.capitalize(tableName)}`];
    const mysqlTable = (schema as any)[`mysql${this.capitalize(tableName)}`];
    
    if (!sqliteTable || !mysqlTable) {
      throw new Error(`Table ${tableName} not found in schema`);
    }
    
    return this.usingSqlite ? sqliteTable : mysqlTable;
  }

  /**
   * Execute a SELECT query
   */
  async select<T = any>(
    tableName: keyof typeof schema,
    config: SelectConfig,
    options: SelectOptions = {}
  ): Promise<QueryResult<T>> {
    const table = this.getTable(tableName);
    let query = (this.db as any).select(config).from(table);

    // Apply joins
    if (options.joins) {
      for (const join of options.joins) {
        query = query[join.type](join.table, join.on);
      }
    }

    // Apply where clause
    if (options.where) {
      query = query.where(options.where);
    }

    // Apply order by
    if (options.orderBy) {
      query = query.orderBy(options.orderBy);
    }

    // Apply limit and offset
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
      if (options.offset !== undefined) {
        query = query.offset(options.offset);
      }
    }

    const data = await query;
    return { data };
  }

  /**
   * Execute a SELECT query with count
   */
  async selectWithCount<T = any>(
    tableName: keyof typeof schema,
    config: SelectConfig,
    options: SelectOptions = {}
  ): Promise<QueryResult<T>> {
    const result = await this.select<T>(tableName, config, options);
    
    // Get total count without limit/offset
    const countOptions = { ...options };
    delete countOptions.limit;
    delete countOptions.offset;
    
    const countResult = await this.select(tableName, { count: count() }, countOptions);
    const totalCount = countResult.data[0]?.count || 0;
    
    return { ...result, count: totalCount };
  }

  /**
   * Execute a SELECT query for a single record
   */
  async selectOne<T = any>(
    tableName: keyof typeof schema,
    config: SelectConfig,
    options: SelectOptions = {}
  ): Promise<SingleResult<T>> {
    const limitedOptions = { ...options, limit: 1 };
    const result = await this.select<T>(tableName, config, limitedOptions);
    return { data: result.data[0] || null };
  }

  /**
   * Execute an INSERT query
   */
  async insert(
    tableName: keyof typeof schema,
    data: Record<string, any>,
    _options: InsertOptions = {}
  ): Promise<InsertResult> {
    const table = this.getTable(tableName);
    const query = (this.db as any).insert(table).values(data);
    
    const result = await query;
    
    // Handle different return formats
    if (Array.isArray(result) && result[0] && result[0].id) {
      return result[0];
    } else if (result && result.insertId) {
      return { id: result.insertId, ...data };
    } else if (result && result[0] && typeof result[0] === 'object') {
      return result[0];
    }
    
    // Default fallback
    return { id: 0, ...data };
  }

  /**
   * Execute an UPDATE query
   */
  async update(
    tableName: keyof typeof schema,
    data: Record<string, any>,
    options: UpdateOptions
  ): Promise<UpdateResult> {
    const table = this.getTable(tableName);
    const query = (this.db as any).update(table).set(data).where(options.where);
    
    const result = await query;
    
    // Handle different return formats
    if (Array.isArray(result)) {
      return { affectedRows: result.length };
    } else if (result && result.affectedRows !== undefined) {
      return { affectedRows: result.affectedRows };
    }
    
    return { affectedRows: 0 };
  }

  /**
   * Execute a DELETE query
   */
  async delete(
    tableName: keyof typeof schema,
    options: DeleteOptions
  ): Promise<DeleteResult> {
    const table = this.getTable(tableName);
    const query = (this.db as any).delete(table).where(options.where);
    
    const result = await query;
    
    // Handle different return formats
    if (Array.isArray(result)) {
      return { affectedRows: result.length };
    } else if (result && result.affectedRows !== undefined) {
      return { affectedRows: result.affectedRows };
    }
    
    return { affectedRows: 0 };
  }

  /**
   * Execute a raw SQL query
   */
  async executeRaw<T = any>(sqlTemplate: SQL): Promise<T[]> {
    const result = await (this.db as any).execute(sqlTemplate);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get date in appropriate format for current database
   */
  formatDate(date: Date = new Date()): string | Date {
    return this.usingSqlite ? date.toISOString() : date;
  }

  /**
   * Check if using SQLite
   */
  isUsingSqlite(): boolean {
    return this.usingSqlite;
  }

  /**
   * Helper method to capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Convenience function to create a DatabaseWrapper instance
 */
export async function createDbWrapper(): Promise<DatabaseWrapper> {
  return DatabaseWrapper.create();
}

/**
 * Get a table reference
 */
export function getTable(tableName: keyof typeof schema): Table {
  const usingSqlite = isSqlite();
  const sqliteTable = (schema as any)[`sqlite${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`];
  const mysqlTable = (schema as any)[`mysql${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`];
  
  if (!sqliteTable || !mysqlTable) {
    throw new Error(`Table ${tableName} not found in schema`);
  }
  
  return usingSqlite ? sqliteTable : mysqlTable;
}