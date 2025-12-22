import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export type SqliteDb = BetterSQLite3Database<typeof schema>;
export type MysqlDb = MySql2Database<typeof schema>;
export type Db = SqliteDb | MysqlDb;

// Environment detection - use custom DB_TYPE env var since Next.js overrides NODE_ENV
export function isSqlite(): boolean {
  // Use DB_TYPE=sqlite for SQLite, otherwise use MySQL
  return process.env.DB_TYPE === 'sqlite';
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Track if schema sync has been performed
let schemaSyncCompleted = false;

export function isSchemaSynced(): boolean {
  return schemaSyncCompleted;
}

export function markSchemaSynced(): void {
  schemaSyncCompleted = true;
}

// SQLite connection (for testing)
let sqliteDb: SqliteDb | null = null;

const DB_PATH = process.env.SQLITE_DB_PATH || '/home/ubuntu/herbal-medicine-erp/data/herbal-erp.db';

export function getSqliteDb(dbPath: string = DB_PATH): SqliteDb {
  if (!sqliteDb) {
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqliteDb = drizzleSqlite(sqlite, { schema });
  }
  return sqliteDb;
}

// MySQL connection pool (for production)
let mysqlPool: mysql.Pool | null = null;
let mysqlDb: MysqlDb | null = null;

export async function getMysqlDb(): Promise<MysqlDb> {
  if (!mysqlDb) {
    // Parse DATABASE_URL if provided
    const databaseUrl = process.env.DATABASE_URL;
    let connectionConfig: mysql.PoolOptions;

    if (databaseUrl) {
      // Parse mysql://user:password@host:port/database format
      const url = new URL(databaseUrl);
      connectionConfig = {
        host: url.hostname,
        port: parseInt(url.port || '3306'),
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading /
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
    } else {
      connectionConfig = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'herbal_erp',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
    }

    mysqlPool = mysql.createPool(connectionConfig);
    mysqlDb = drizzleMysql(mysqlPool as any, { schema, mode: 'default' });
  }
  return mysqlDb;
}

// Get appropriate database based on environment
export async function getDb(): Promise<Db> {
  if (isSqlite()) {
    return getSqliteDb();
  }
  return getMysqlDb();
}

// Close connections
export async function closeConnections() {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
    mysqlDb = null;
  }
  sqliteDb = null;
  schemaSyncCompleted = false;
}

// Database initialization using schema sync
// This is kept for backward compatibility - actual sync happens via instrumentation
export async function initializeDatabase() {
  // Import schema sync dynamically to avoid circular dependencies
  const { syncDatabaseSchema } = await import('./schema-sync');

  if (!schemaSyncCompleted) {
    await syncDatabaseSchema();
    schemaSyncCompleted = true;
  }

  return getDb();
}

// Synchronous db getter for services
let cachedDb: any = null;

export function db() {
  if (cachedDb) return cachedDb;
  if (isSqlite()) {
    cachedDb = getSqliteDb();
  } else {
    // For MySQL, we need async initialization
    // This is a workaround - in production, initialize at startup
    throw new Error('MySQL requires async initialization. Use getDb() instead.');
  }
  return cachedDb;
}

export { schema };
