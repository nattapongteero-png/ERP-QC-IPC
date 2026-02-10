/**
 * Schema-Field Validator: Static Code Analysis Test
 *
 * Prevents "silent data loss" bugs by verifying that form fields,
 * API handlers, and database schema columns are consistent.
 *
 * When this test fails, it means:
 * - A form field exists in UI but the API doesn't save it → data loss
 * - An API tries to insert a field that doesn't exist in DB → potential error
 * - A form collects data that has no corresponding DB column → wasted UX
 *
 * How it works:
 * 1. Parses Drizzle ORM schema.ts to extract DB column names per table
 * 2. Parses API route.ts files to extract fields from POST body destructuring
 * 3. Parses page.tsx files to extract form state field names
 * 4. Compares the three sets and reports mismatches
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

// ─── Parsers ────────────────────────────────────────────────────────

/**
 * Extract column names from a Drizzle ORM SQLite table definition.
 * Pattern: `fieldName: integer('column_name')...`
 */
function parseSchemaColumns(tableName: string): Set<string> {
  const content = readFileSync(resolve(ROOT, 'src/lib/db/schema.ts'), 'utf-8');

  // Find the sqlite table definition block
  const tablePattern = new RegExp(
    `export const sqlite${capitalize(tableName)}\\s*=\\s*sqliteTable\\('[^']+',\\s*\\{([\\s\\S]*?)\\}\\);`,
    'm'
  );
  const match = content.match(tablePattern);
  if (!match) {
    throw new Error(`Schema table "sqlite${capitalize(tableName)}" not found in schema.ts`);
  }

  const body = match[1];
  const columns = new Set<string>();

  // Match property definitions: `fieldName: integer|text|real|blob('...')`
  const fieldPattern = /^\s+(\w+):\s+(?:integer|text|real|blob)\(/gm;
  let fieldMatch;
  while ((fieldMatch = fieldPattern.exec(body)) !== null) {
    columns.add(fieldMatch[1]);
  }

  return columns;
}

/**
 * Extract field names from API POST handler's body destructuring.
 * Pattern: `const { field1, field2, ... } = body;`
 */
function parseApiBodyFields(apiRoutePath: string): Set<string> {
  const content = readFileSync(resolve(ROOT, apiRoutePath), 'utf-8');
  const fields = new Set<string>();

  // Match destructuring from body: const { ... } = body;
  const destructurePattern = /const\s*\{([\s\S]*?)\}\s*=\s*body;/g;
  let match;
  while ((match = destructurePattern.exec(content)) !== null) {
    const body = match[1];
    // Extract field names (skip comments)
    const fieldPattern = /^\s*(\w+)\s*[,}]/gm;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(body)) !== null) {
      fields.add(fieldMatch[1]);
    }
  }

  return fields;
}

/**
 * Extract field names from API POST handler's .values({...}) block.
 * Pattern: `db.insert(table).values({ field1, field2: value, ... })`
 */
function parseApiInsertFields(apiRoutePath: string): Set<string> {
  const content = readFileSync(resolve(ROOT, apiRoutePath), 'utf-8');
  const fields = new Set<string>();

  // Match .values({ ... }) blocks
  const valuesPattern = /\.values\(\{([\s\S]*?)\}\)/g;
  let match;
  while ((match = valuesPattern.exec(content)) !== null) {
    const body = match[1];
    // Extract property names (left side of colon or shorthand)
    const fieldPattern = /^\s+(\w+)(?:\s*[:,])/gm;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(body)) !== null) {
      fields.add(fieldMatch[1]);
    }
  }

  return fields;
}

/**
 * Extract field names from form state initialization.
 * Handles multiple patterns:
 * - useState<Type>({ field1: '', field2: 0 })
 * - useState({ field1: '', field2: 0 })
 * Uses the specified state variable name to find the right useState call.
 */
function parseFormStateFields(pagePath: string, stateVarName: string): Set<string> {
  const content = readFileSync(resolve(ROOT, pagePath), 'utf-8');
  const fields = new Set<string>();

  // Pattern: const [stateVarName, setXxx] = useState<...>({ ... })
  // or:      const [stateVarName, setXxx] = useState({ ... })
  const pattern = new RegExp(
    `const\\s+\\[${stateVarName},\\s*set\\w+\\]\\s*=\\s*useState(?:<[^>]+>)?\\(\\{([\\s\\S]*?)\\}\\)`,
    'g'
  );

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const body = match[1];
    // Extract property names
    const fieldPattern = /^\s+(\w+)\s*:/gm;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(body)) !== null) {
      fields.add(fieldMatch[1]);
    }
  }

  return fields;
}

/**
 * Extract fields from a TypeScript interface definition.
 * Pattern: `interface InterfaceName { field1: type; field2: type; }`
 */
function parseInterfaceFields(filePath: string, interfaceName: string): Set<string> {
  const content = readFileSync(resolve(ROOT, filePath), 'utf-8');
  const fields = new Set<string>();

  const pattern = new RegExp(
    `interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\}`,
    'm'
  );
  const match = content.match(pattern);
  if (!match) return fields;

  const body = match[1];
  const fieldPattern = /^\s+(\w+)[\s?]*:/gm;
  let fieldMatch;
  while ((fieldMatch = fieldPattern.exec(body)) !== null) {
    fields.add(fieldMatch[1]);
  }

  return fields;
}

// ─── Helpers ────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter(x => !b.has(x)));
}

// ─── Module Definitions ─────────────────────────────────────────────

interface ModuleDefinition {
  /** Human-readable module name */
  name: string;
  /** Drizzle ORM table name (without sqlite/mysql prefix, PascalCase) */
  schemaTable: string;
  /** Path to page.tsx with form */
  formPage: string;
  /** State variable name used in useState */
  formStateVar: string;
  /** Path to API route.ts with POST handler */
  apiRoute: string;
  /** Fields that only exist in the form (computed, UI-only state) */
  formOnlyFields?: string[];
  /** Fields that the API sets automatically (not from user form) */
  apiAutoFields?: string[];
  /** Fields in DB that are system-managed (timestamps, auto-increment) */
  dbSystemFields?: string[];
}

// Auto-managed DB fields common to all tables
const COMMON_DB_SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt'];

const MODULE_MAP: ModuleDefinition[] = [
  {
    name: 'inventory-lots',
    schemaTable: 'InventoryLots',
    formPage: 'src/app/inventory/lots/page.tsx',
    formStateVar: 'formData',
    apiRoute: 'src/app/api/inventory/lots/route.ts',
    formOnlyFields: ['notes'],
    // API auto: fields set by server + child table (InventoryTransactions) fields from multi-table insert
    apiAutoFields: ['reservedQuantity', 'status', 'receivedDate',
      // Transaction record fields (inserted in same API route)
      'lotId', 'transactionType', 'referenceType', 'referenceId', 'referenceNumber',
      'fromWarehouseId', 'toWarehouseId', 'reason', 'performedBy', 'approvedBy'],
    dbSystemFields: [...COMMON_DB_SYSTEM_FIELDS, 'reservedQuantity', 'lastRetestDate', 'retestStatus'],
  },
  {
    name: 'purchasing-orders',
    schemaTable: 'PurchaseOrders',
    formPage: 'src/app/purchasing/orders/new/page.tsx',
    formStateVar: 'formData',
    apiRoute: 'src/app/api/purchasing/orders/route.ts',
    formOnlyFields: [],
    // API auto: fields set by server + child table (PO Lines) fields from multi-table insert
    apiAutoFields: ['poNumber', 'status', 'orderDate', 'totalAmount', 'currency', 'createdBy',
      // PO Lines table fields (inserted in same API route)
      'poId', 'itemId', 'quantity', 'receivedQuantity', 'unit', 'unitPrice', 'totalPrice'],
    dbSystemFields: [...COMMON_DB_SYSTEM_FIELDS, 'approvedBy', 'approvedDate'],
  },
  {
    name: 'sales-orders',
    schemaTable: 'SalesOrders',
    formPage: 'src/app/sales/orders/new/page.tsx',
    formStateVar: 'form',
    apiRoute: 'src/app/api/sales/orders/route.ts',
    formOnlyFields: ['lines'],
    // API auto: fields set by server + child table (SO Lines) fields from multi-table insert
    apiAutoFields: ['orderNumber', 'status', 'totalAmount', 'createdBy', 'orderDate',
      // SO Lines table fields (inserted in same API route)
      'soId', 'itemId', 'lotId', 'quantity', 'shippedQuantity', 'unit', 'unitPrice', 'totalPrice'],
    dbSystemFields: [...COMMON_DB_SYSTEM_FIELDS, 'approvedBy', 'approvedDate', 'deliveredDate'],
  },
  {
    name: 'customers',
    schemaTable: 'Customers',
    formPage: 'src/app/sales/customers/new/page.tsx',
    formStateVar: 'form',
    apiRoute: 'src/app/api/customers/route.ts',
    formOnlyFields: [],
    apiAutoFields: [],
    dbSystemFields: COMMON_DB_SYSTEM_FIELDS,
  },
  {
    name: 'vendors',
    schemaTable: 'Vendors',
    formPage: 'src/app/purchasing/vendors/new/page.tsx',
    formStateVar: 'form',
    apiRoute: 'src/app/api/vendors/route.ts',
    formOnlyFields: [],
    apiAutoFields: [],
    dbSystemFields: COMMON_DB_SYSTEM_FIELDS,
  },
  {
    name: 'inventory-transactions',
    schemaTable: 'InventoryTransactions',
    formPage: 'src/app/inventory/transactions/page.tsx',
    formStateVar: 'formData',
    apiRoute: 'src/app/api/inventory/transactions/route.ts',
    // Form uses 'type'→'transactionType', 'notes'→'reason' (field name mapping)
    formOnlyFields: ['type', 'notes'],
    apiAutoFields: ['performedBy'],
    dbSystemFields: [...COMMON_DB_SYSTEM_FIELDS, 'approvedBy'],
  },
];

// ─── Tests ──────────────────────────────────────────────────────────

describe('Schema-Field Validator', () => {
  describe('Parser sanity checks', () => {
    it('should parse schema columns for InventoryLots', () => {
      const columns = parseSchemaColumns('InventoryLots');
      expect(columns.size).toBeGreaterThan(10);
      expect(columns.has('lotNumber')).toBe(true);
      expect(columns.has('quantity')).toBe(true);
      expect(columns.has('vendorLotNumber')).toBe(true);
      expect(columns.has('cost')).toBe(true);
    });

    it('should parse API body fields for inventory lots', () => {
      const fields = parseApiBodyFields('src/app/api/inventory/lots/route.ts');
      expect(fields.size).toBeGreaterThan(5);
      expect(fields.has('itemId')).toBe(true);
      expect(fields.has('lotNumber')).toBe(true);
    });

    it('should parse form state fields for inventory lots', () => {
      const fields = parseFormStateFields('src/app/inventory/lots/page.tsx', 'formData');
      expect(fields.size).toBeGreaterThan(5);
      expect(fields.has('lotNumber')).toBe(true);
      expect(fields.has('vendorLotNumber')).toBe(true);
      expect(fields.has('cost')).toBe(true);
    });
  });

  // Dynamic test generation for each module
  for (const mod of MODULE_MAP) {
    describe(`Module: ${mod.name}`, () => {
      let schemaColumns: Set<string>;
      let apiBodyFields: Set<string>;
      let apiInsertFields: Set<string>;
      let formFields: Set<string>;

      beforeAll(() => {
        schemaColumns = parseSchemaColumns(mod.schemaTable);
        apiBodyFields = parseApiBodyFields(mod.apiRoute);
        apiInsertFields = parseApiInsertFields(mod.apiRoute);
        formFields = parseFormStateFields(mod.formPage, mod.formStateVar);
      });

      it('Form fields should be accepted by API POST (no silent data loss)', () => {
        const formOnlyExceptions = new Set(mod.formOnlyFields || []);

        // Form fields that are NOT in API body destructuring
        const formFieldsToCheck = setDifference(formFields, formOnlyExceptions);
        const missingInApi = setDifference(formFieldsToCheck, apiBodyFields);

        // Also check against insert values (some APIs don't destructure but do insert)
        const missingInBoth = setDifference(missingInApi, apiInsertFields);

        if (missingInBoth.size > 0) {
          const fieldList = [...missingInBoth].join(', ');
          throw new Error(
            `SILENT DATA LOSS RISK in ${mod.name}!\n` +
            `Form has fields that API POST does NOT handle:\n` +
            `  Missing: ${fieldList}\n` +
            `  These fields will be silently dropped when the form is submitted.\n` +
            `  Fix: Add these fields to the API route's body destructuring AND insert values.`
          );
        }
      });

      it('API insert fields should exist in DB schema (no insert errors)', () => {
        const apiAutoExceptions = new Set(mod.apiAutoFields || []);
        const dbSystemExceptions = new Set(mod.dbSystemFields || []);

        // Combine all exceptions
        const allExceptions = new Set([...apiAutoExceptions, ...dbSystemExceptions]);

        // API insert fields that are NOT in schema columns
        const insertFieldsToCheck = setDifference(apiInsertFields, allExceptions);
        const missingInSchema = setDifference(insertFieldsToCheck, schemaColumns);

        if (missingInSchema.size > 0) {
          const fieldList = [...missingInSchema].join(', ');
          throw new Error(
            `SCHEMA MISMATCH in ${mod.name}!\n` +
            `API tries to insert fields that don't exist in DB schema:\n` +
            `  Missing columns: ${fieldList}\n` +
            `  Fix: Add these columns to the Drizzle schema definition.`
          );
        }
      });

      it('Form fields should have corresponding DB columns (data can be persisted)', () => {
        const formOnlyExceptions = new Set(mod.formOnlyFields || []);

        // Form fields (minus UI-only) that don't exist in schema
        const formFieldsToCheck = setDifference(formFields, formOnlyExceptions);
        const missingInSchema = setDifference(formFieldsToCheck, schemaColumns);

        if (missingInSchema.size > 0) {
          const fieldList = [...missingInSchema].join(', ');
          throw new Error(
            `FORM-SCHEMA MISMATCH in ${mod.name}!\n` +
            `Form collects data with no DB column to store it:\n` +
            `  Missing columns: ${fieldList}\n` +
            `  Fix: Either add DB columns or mark these as formOnlyFields in MODULE_MAP.`
          );
        }
      });

      it('should report field coverage summary', () => {
        const summary = {
          module: mod.name,
          schemaColumns: schemaColumns.size,
          apiBodyFields: apiBodyFields.size,
          apiInsertFields: apiInsertFields.size,
          formFields: formFields.size,
        };
        // This test always passes - just logs the coverage info
        console.log(`  [${mod.name}] Schema=${summary.schemaColumns} cols, API=${summary.apiBodyFields} body + ${summary.apiInsertFields} insert, Form=${summary.formFields} fields`);
        expect(true).toBe(true);
      });
    });
  }
});

// Export parsers for reuse in other tests
export {
  parseSchemaColumns,
  parseApiBodyFields,
  parseApiInsertFields,
  parseFormStateFields,
  parseInterfaceFields,
  MODULE_MAP,
};
