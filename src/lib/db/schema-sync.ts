/**
 * Schema Synchronization Utility
 *
 * Dynamically compares Drizzle ORM schema definitions with actual database structure
 * and creates missing tables/columns without using migration files.
 */

import { getTableName, getTableColumns, sql } from 'drizzle-orm';
import { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import * as schema from './schema';
import { isSqlite, getSqliteDb, getMysqlDb, markSchemaSynced } from './index';
import Database from 'better-sqlite3';

// Type definitions for column info from Drizzle
interface ColumnInfo {
  name: string;
  dataType: string;
  isNotNull: boolean;
  hasDefault: boolean;
  defaultValue: unknown;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
}

// Type definitions for database column info
interface DbColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

// Map Drizzle column types to SQL types
function mapDrizzleTypeToSqlite(column: SQLiteColumn): string {
  const columnType = column.dataType;

  switch (columnType) {
    case 'string':
      return 'TEXT';
    case 'number':
      // Check if it's integer or real based on column config
      const sqlName = column.getSQLType?.() || 'INTEGER';
      if (sqlName.toLowerCase().includes('real')) return 'REAL';
      return 'INTEGER';
    case 'boolean':
      return 'INTEGER';
    case 'date':
      return 'TEXT';
    case 'json':
      return 'TEXT';
    case 'bigint':
      return 'INTEGER';
    case 'buffer':
      return 'BLOB';
    default:
      return 'TEXT';
  }
}

function mapDrizzleTypeToMysql(column: MySqlColumn): string {
  const sqlType = column.getSQLType?.();
  if (sqlType) return sqlType.toUpperCase();

  const columnType = column.dataType;
  switch (columnType) {
    case 'string':
      return 'VARCHAR(255)';
    case 'number':
      return 'INT';
    case 'boolean':
      return 'TINYINT(1)';
    case 'date':
      return 'DATETIME';
    case 'json':
      return 'JSON';
    case 'bigint':
      return 'BIGINT';
    default:
      return 'TEXT';
  }
}

// Extract column information from Drizzle schema table
function extractColumnsFromTable(table: any, usingSqlite: boolean): ColumnInfo[] {
  const columns: ColumnInfo[] = [];
  const tableColumns = getTableColumns(table);

  for (const [key, column] of Object.entries(tableColumns)) {
    const col = column as any;
    columns.push({
      name: col.name,
      dataType: usingSqlite
        ? mapDrizzleTypeToSqlite(col as SQLiteColumn)
        : mapDrizzleTypeToMysql(col as MySqlColumn),
      isNotNull: col.notNull ?? false,
      hasDefault: col.hasDefault ?? false,
      defaultValue: col.default,
      isPrimaryKey: col.primary ?? false,
      isAutoIncrement: col.autoIncrement ?? false,
      isUnique: col.isUnique ?? false,
    });
  }

  return columns;
}

// Get all tables from schema based on database type
function getSchemaTablesForDb(usingSqlite: boolean): Map<string, any> {
  const tables = new Map<string, any>();

  for (const [key, value] of Object.entries(schema)) {
    // Skip non-table exports (types, relations, etc.)
    if (typeof value !== 'object' || value === null) continue;

    // Check if it's a Drizzle table using instanceof
    if (usingSqlite && value instanceof SQLiteTable) {
      const tableName = getTableName(value);
      tables.set(tableName, value);
    } else if (!usingSqlite && value instanceof MySqlTable) {
      const tableName = getTableName(value);
      tables.set(tableName, value);
    }
  }

  return tables;
}

// Get existing tables from SQLite database
async function getSqliteExistingTables(db: any): Promise<Set<string>> {
  const sqlite = db.session?.client as Database.Database;
  if (!sqlite) return new Set();

  const result = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as { name: string }[];

  return new Set(result.map(r => r.name));
}

// Get existing tables from MySQL database
async function getMysqlExistingTables(db: any): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT TABLE_NAME as name
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
  `);

  return new Set((result[0] as any[]).map((r: any) => r.name || r.TABLE_NAME));
}

// Get columns of a table from SQLite
function getSqliteTableColumns(db: any, tableName: string): DbColumnInfo[] {
  const sqlite = db.session?.client as Database.Database;
  if (!sqlite) return [];

  const result = sqlite.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];

  return result.map(row => ({
    name: row.name,
    type: row.type,
    notNull: row.notnull === 1,
    defaultValue: row.dflt_value,
    primaryKey: row.pk === 1,
  }));
}

// Get columns of a table from MySQL
async function getMysqlTableColumns(db: any, tableName: string): Promise<DbColumnInfo[]> {
  const result = await db.execute(sql`
    SELECT
      COLUMN_NAME as name,
      COLUMN_TYPE as type,
      IS_NULLABLE as nullable,
      COLUMN_DEFAULT as defaultValue,
      COLUMN_KEY as columnKey
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tableName}
  `);

  return (result[0] as any[]).map((row: any) => ({
    name: row.name || row.COLUMN_NAME,
    type: row.type || row.COLUMN_TYPE,
    notNull: (row.nullable || row.IS_NULLABLE) === 'NO',
    defaultValue: row.defaultValue || row.COLUMN_DEFAULT,
    primaryKey: (row.columnKey || row.COLUMN_KEY) === 'PRI',
  }));
}

// Generate CREATE TABLE SQL for SQLite
function generateSqliteCreateTable(tableName: string, columns: ColumnInfo[]): string {
  const columnDefs: string[] = [];

  for (const col of columns) {
    let def = `"${col.name}" ${col.dataType}`;

    if (col.isPrimaryKey) {
      def += ' PRIMARY KEY';
      if (col.isAutoIncrement) {
        def += ' AUTOINCREMENT';
      }
    }

    if (col.isNotNull && !col.isPrimaryKey) {
      def += ' NOT NULL';
    }

    if (col.hasDefault && col.defaultValue !== undefined) {
      const defaultVal = formatDefaultValue(col.defaultValue, true);
      if (defaultVal !== null) {
        def += ` DEFAULT ${defaultVal}`;
      }
    }

    if (col.isUnique && !col.isPrimaryKey) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

// Generate CREATE TABLE SQL for MySQL
// Note: Foreign keys are intentionally omitted for compatibility with MySQL engines that don't support them
function generateMysqlCreateTable(tableName: string, columns: ColumnInfo[]): string {
  const columnDefs: string[] = [];
  let primaryKeyCol: string | null = null;

  for (const col of columns) {
    let def = `\`${col.name}\` ${col.dataType}`;

    if (col.isNotNull) {
      def += ' NOT NULL';
    }

    if (col.isAutoIncrement) {
      def += ' AUTO_INCREMENT';
      primaryKeyCol = col.name;
    }

    // Skip DEFAULT for TEXT, BLOB, JSON, GEOMETRY columns - MySQL doesn't allow defaults for these types
    const noDefaultTypes = ['TEXT', 'BLOB', 'JSON', 'GEOMETRY', 'MEDIUMTEXT', 'LONGTEXT', 'TINYTEXT'];
    const upperDataType = col.dataType.toUpperCase();
    const canHaveDefault = !noDefaultTypes.some(t => upperDataType.includes(t));

    if (col.hasDefault && col.defaultValue !== undefined && !col.isAutoIncrement && canHaveDefault) {
      const defaultVal = formatDefaultValue(col.defaultValue, false);
      if (defaultVal !== null) {
        def += ` DEFAULT ${defaultVal}`;
      }
    }

    if (col.isUnique && !col.isPrimaryKey) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  // Add PRIMARY KEY constraint
  if (primaryKeyCol) {
    columnDefs.push(`PRIMARY KEY (\`${primaryKeyCol}\`)`);
  } else {
    const pkCol = columns.find(c => c.isPrimaryKey);
    if (pkCol) {
      columnDefs.push(`PRIMARY KEY (\`${pkCol.name}\`)`);
    }
  }

  // Don't specify ENGINE - use database default (RocksDB)
  // Foreign key constraints are defined in ORM schema but not enforced at DB level
  return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n  ${columnDefs.join(',\n  ')}\n) DEFAULT CHARSET=utf8mb4`;
}

// Generate ALTER TABLE ADD COLUMN SQL
function generateAddColumnSql(tableName: string, column: ColumnInfo, usingSqlite: boolean): string {
  if (usingSqlite) {
    let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.dataType}`;

    // SQLite has limited ALTER TABLE support - can't add NOT NULL without default
    if (column.hasDefault && column.defaultValue !== undefined) {
      const defaultVal = formatDefaultValue(column.defaultValue, true);
      if (defaultVal !== null) {
        sql += ` DEFAULT ${defaultVal}`;
      }
    }

    return sql;
  } else {
    let sql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column.name}\` ${column.dataType}`;

    // Skip DEFAULT for TEXT, BLOB, JSON, GEOMETRY columns - MySQL doesn't allow defaults for these types
    const noDefaultTypes = ['TEXT', 'BLOB', 'JSON', 'GEOMETRY', 'MEDIUMTEXT', 'LONGTEXT', 'TINYTEXT'];
    const upperDataType = column.dataType.toUpperCase();
    const canHaveDefault = !noDefaultTypes.some(t => upperDataType.includes(t));

    if (column.isNotNull && column.hasDefault && canHaveDefault) {
      sql += ' NOT NULL';
    }

    if (column.hasDefault && column.defaultValue !== undefined && canHaveDefault) {
      const defaultVal = formatDefaultValue(column.defaultValue, false);
      if (defaultVal !== null) {
        sql += ` DEFAULT ${defaultVal}`;
      }
    }

    return sql;
  }
}

// Format default value for SQL
function formatDefaultValue(value: unknown, usingSqlite: boolean): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'function') {
    // Handle SQL expressions like CURRENT_TIMESTAMP
    return null; // Skip function defaults for simplicity
  }

  if (typeof value === 'string') {
    if (value === 'CURRENT_TIMESTAMP') return value;
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return usingSqlite ? (value ? '1' : '0') : (value ? 'TRUE' : 'FALSE');
  }

  if (value instanceof Date) {
    if (usingSqlite) {
      return 'CURRENT_TIMESTAMP';
    }
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }

  return null;
}

// Main sync function
export async function syncDatabaseSchema(): Promise<{
  tablesCreated: string[];
  columnsAdded: { table: string; column: string }[];
  errors: string[];
}> {
  const usingSqlite = isSqlite();
  const result = {
    tablesCreated: [] as string[],
    columnsAdded: [] as { table: string; column: string }[],
    errors: [] as string[],
  };

  console.log(`[Schema Sync] Starting schema synchronization for ${usingSqlite ? 'SQLite' : 'MySQL'}...`);

  try {
    const db = usingSqlite ? getSqliteDb() : await getMysqlDb();
    const schemaTables = getSchemaTablesForDb(usingSqlite);

    console.log(`[Schema Sync] Found ${schemaTables.size} tables in ORM schema`);

    // Get existing tables from database
    const existingTables = usingSqlite
      ? await getSqliteExistingTables(db)
      : await getMysqlExistingTables(db);

    console.log(`[Schema Sync] Found ${existingTables.size} existing tables in database`);

    // Process each table in schema
    for (const [tableName, table] of schemaTables) {
      const schemaColumns = extractColumnsFromTable(table, usingSqlite);

      if (!existingTables.has(tableName)) {
        // Table doesn't exist - create it
        console.log(`[Schema Sync] Creating missing table: ${tableName}`);

        try {
          const createSql = usingSqlite
            ? generateSqliteCreateTable(tableName, schemaColumns)
            : generateMysqlCreateTable(tableName, schemaColumns);

          if (usingSqlite) {
            const sqlite = (db as any).session?.client as Database.Database;
            sqlite.exec(createSql);
          } else {
            await (db as any).execute(sql.raw(createSql));
          }

          result.tablesCreated.push(tableName);
          console.log(`[Schema Sync] Created table: ${tableName}`);
        } catch (err) {
          const errorMsg = `Failed to create table ${tableName}: ${err}`;
          result.errors.push(errorMsg);
          console.error(`[Schema Sync] ${errorMsg}`);
        }
      } else {
        // Table exists - check for missing columns
        const dbColumns = usingSqlite
          ? getSqliteTableColumns(db, tableName)
          : await getMysqlTableColumns(db, tableName);

        const existingColumnNames = new Set(dbColumns.map(c => c.name.toLowerCase()));

        for (const schemaCol of schemaColumns) {
          if (!existingColumnNames.has(schemaCol.name.toLowerCase())) {
            // Column doesn't exist - add it
            console.log(`[Schema Sync] Adding missing column: ${tableName}.${schemaCol.name}`);

            try {
              const alterSql = generateAddColumnSql(tableName, schemaCol, usingSqlite);

              if (usingSqlite) {
                const sqlite = (db as any).session?.client as Database.Database;
                sqlite.exec(alterSql);
              } else {
                await (db as any).execute(sql.raw(alterSql));
              }

              result.columnsAdded.push({ table: tableName, column: schemaCol.name });
              console.log(`[Schema Sync] Added column: ${tableName}.${schemaCol.name}`);
            } catch (err) {
              const errorMsg = `Failed to add column ${tableName}.${schemaCol.name}: ${err}`;
              result.errors.push(errorMsg);
              console.error(`[Schema Sync] ${errorMsg}`);
            }
          }
        }
      }
    }

    console.log(`[Schema Sync] Synchronization complete.`);
    console.log(`[Schema Sync] Tables created: ${result.tablesCreated.length}`);
    console.log(`[Schema Sync] Columns added: ${result.columnsAdded.length}`);
    if (result.errors.length > 0) {
      console.log(`[Schema Sync] Errors: ${result.errors.length}`);
    }

    // Mark schema as synced
    markSchemaSynced();

  } catch (err) {
    const errorMsg = `Schema sync failed: ${err}`;
    result.errors.push(errorMsg);
    console.error(`[Schema Sync] ${errorMsg}`);
  }

  return result;
}

// Initialize database with schema sync and lookup table seeding
export async function initializeDatabaseWithSync(): Promise<void> {
  console.log('[Database] Initializing database with schema sync...');
  await syncDatabaseSchema();

  // Seed lookup tables if they are empty
  try {
    const { seedLookupTables } = await import('./seed-lookup');
    await seedLookupTables();
  } catch (error) {
    console.error('[Database] Failed to seed lookup tables:', error);
    // Don't throw - allow server to start even if seeding fails
  }

  // Seed HR lookup tables if they are empty
  try {
    const { seedHRTables } = await import('./seed-hr');
    await seedHRTables();
  } catch (error) {
    console.error('[Database] Failed to seed HR tables:', error);
    // Don't throw - allow server to start even if seeding fails
  }

  // Seed GMP compliance lookup tables if they are empty
  try {
    const { seedGmpTables } = await import('./seed-gmp');
    await seedGmpTables();
  } catch (error) {
    console.error('[Database] Failed to seed GMP tables:', error);
    // Don't throw - allow server to start even if seeding fails
  }

  // Seed accounting lookup tables if they are empty
  try {
    const { seedAccountingTables } = await import('./seed-accounting');
    await seedAccountingTables();
  } catch (error) {
    console.error('[Database] Failed to seed accounting tables:', error);
    // Don't throw - allow server to start even if seeding fails
  }

  // Seed demo users if users table is empty
  try {
    await seedDemoUsersIfEmpty();
  } catch (error) {
    console.error('[Database] Failed to seed demo users:', error);
    // Don't throw - allow server to start even if seeding fails
  }

  console.log('[Database] Database initialization complete.');
}

/**
 * Seed demo users if the users table is empty
 * These are the credentials shown on the login page
 */
async function seedDemoUsersIfEmpty(): Promise<void> {
  const usingSqlite = isSqlite();
  const usersTable = usingSqlite ? schema.sqliteUsers : schema.mysqlUsers;

  // Check if users table is empty
  let isEmpty = false;
  try {
    if (usingSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw('SELECT COUNT(*) as count FROM "users"'));
      isEmpty = (result[0] as any)?.count === 0;
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw('SELECT COUNT(*) as count FROM `users`'));
      isEmpty = (result[0] as unknown as any[])[0]?.count === 0;
    }
  } catch (error) {
    // Table might not exist - assume we should try to seed
    console.log('[User Seed] Could not check users table, will attempt to seed');
    isEmpty = true;
  }

  if (!isEmpty) {
    console.log('[User Seed] Users table already has data, skipping demo user seed');
    return;
  }

  console.log('[User Seed] Seeding demo users...');

  // Import hashPassword dynamically to avoid circular dependencies
  const { hashPassword } = await import('../auth');

  const adminPassword = await hashPassword('admin123');
  const userPassword = await hashPassword('user123');

  // Demo users matching the login page credentials
  const demoUsers = [
    { email: 'admin@herbal-erp.com', password: adminPassword, name: 'System Administrator', role: 'admin', department: 'IT' },
    { email: 'production@herbal-erp.com', password: userPassword, name: 'Production Manager', role: 'production', department: 'Production' },
    { email: 'qc@herbal-erp.com', password: userPassword, name: 'QC Manager', role: 'qc', department: 'Quality Control' },
    { email: 'warehouse@herbal-erp.com', password: userPassword, name: 'Warehouse Manager', role: 'warehouse', department: 'Warehouse' },
    { email: 'purchasing@herbal-erp.com', password: userPassword, name: 'Purchasing Manager', role: 'purchasing', department: 'Purchasing' },
    { email: 'sales@herbal-erp.com', password: userPassword, name: 'Sales Manager', role: 'sales', department: 'Sales' },
    { email: 'hr@herbal-erp.com', password: userPassword, name: 'HR Manager', role: 'hr', department: 'Human Resources' },
  ];

  try {
    if (usingSqlite) {
      const db = getSqliteDb();
      for (const user of demoUsers) {
        await (db as any).insert(usersTable).values({ ...user, isActive: true }).onConflictDoNothing();
      }
    } else {
      const db = await getMysqlDb();
      for (const user of demoUsers) {
        try {
          await (db as any).insert(usersTable).values({ ...user, isActive: true });
        } catch (error: any) {
          // Ignore duplicate entry errors
          if (!error.code?.includes('ER_DUP_ENTRY') && !error.message?.includes('Duplicate entry')) {
            throw error;
          }
        }
      }
    }
    console.log(`[User Seed] Created ${demoUsers.length} demo users`);
  } catch (error) {
    console.error('[User Seed] Failed to seed demo users:', error);
    throw error;
  }
}
