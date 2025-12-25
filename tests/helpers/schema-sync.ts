/**
 * Schema Sync Utility
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Generates CREATE TABLE SQL from Drizzle ORM schema definitions.
 * Ensures test database schema matches production.
 */

import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * Column metadata from Drizzle ORM
 */
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
  primary?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  hasDefault?: boolean;
  default?: unknown;
  isUnique?: boolean;
}

/**
 * Generate CREATE TABLE SQL from Drizzle schema definition
 * @param table - Drizzle table definition (SQLite)
 * @returns SQL CREATE TABLE statement
 */
export function generateCreateTableSql(table: unknown): string {
  const sqliteTable = table as SQLiteTable;
  const tableName = getTableName(sqliteTable);
  const columns = getTableColumns(sqliteTable);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;

    // Map Drizzle data types to SQLite types
    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        def += 'INTEGER';
        break;
      case 'boolean':
        def += 'INTEGER';
        break;
      case 'date':
        def += 'TEXT';
        break;
      case 'json':
        def += 'TEXT';
        break;
      default:
        def += 'TEXT';
    }

    // Add PRIMARY KEY constraint
    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) {
        def += ' AUTOINCREMENT';
      }
    }

    // Add NOT NULL constraint (skip for primary keys - already implied)
    if (col.notNull && !col.primary) {
      def += ' NOT NULL';
    }

    // Add DEFAULT value
    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = formatDefaultValue(col.default);
      if (defaultVal !== null) {
        def += ` DEFAULT ${defaultVal}`;
      }
    }

    // Add UNIQUE constraint (skip for primary keys - already unique)
    if (col.isUnique && !col.primary) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

/**
 * Format default value for SQL
 */
function formatDefaultValue(defaultVal: unknown): string | null {
  if (defaultVal === undefined || defaultVal === null) {
    return null;
  }

  if (typeof defaultVal === 'string') {
    return `'${defaultVal.replace(/'/g, "''")}'`;
  }

  if (typeof defaultVal === 'number') {
    return String(defaultVal);
  }

  if (typeof defaultVal === 'boolean') {
    return defaultVal ? '1' : '0';
  }

  // For functions or complex defaults, skip
  if (typeof defaultVal === 'function') {
    return null;
  }

  return null;
}

/**
 * Get table name from Drizzle table definition
 */
export function getTableNameFromSchema(table: unknown): string {
  return getTableName(table as SQLiteTable);
}

/**
 * Generate multiple CREATE TABLE statements
 * @param tables - Array of Drizzle table definitions
 * @returns Array of SQL CREATE TABLE statements
 */
export function generateCreateTablesSql(tables: unknown[]): string[] {
  return tables.map((table) => generateCreateTableSql(table));
}

/**
 * Common table groups for test setup
 * Use these to quickly set up related tables
 */
export const TABLE_GROUPS = {
  // Core user/auth tables
  users: ['sqliteUsers'],

  // CAPA module tables
  capa: ['sqliteUsers', 'sqliteDeviations', 'sqliteCapa', 'sqliteCapaActions', 'sqliteCapaEffectiveness'],

  // Complaint module tables
  complaints: ['sqliteUsers', 'sqliteItems', 'sqliteInventoryLots', 'sqliteComplaints', 'sqliteComplaintInvestigations', 'sqliteCapa'],

  // Document module tables
  documents: ['sqliteUsers', 'sqliteDocumentTypes', 'sqliteDocuments', 'sqliteDocumentVersions', 'sqliteDocumentApprovals'],

  // Audit module tables
  audits: ['sqliteUsers', 'sqliteAuditPlans', 'sqliteAudits', 'sqliteAuditFindings', 'sqliteAuditChecklists', 'sqliteCapa'],

  // Recall module tables
  recalls: ['sqliteUsers', 'sqliteItems', 'sqliteInventoryLots', 'sqliteRecalls', 'sqliteRecallNotifications', 'sqliteRecallReconciliation'],

  // Sanitation module tables
  sanitation: ['sqliteUsers', 'sqliteSanitationSchedules', 'sqliteSanitationLogs', 'sqlitePestControlLogs'],

  // Stability module tables
  stability: ['sqliteUsers', 'sqliteItems', 'sqliteInventoryLots', 'sqliteStabilityProtocols', 'sqliteStabilityStudies', 'sqliteStabilitySamples', 'sqliteStabilityTrends'],
};
