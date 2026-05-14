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
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, relative } from 'path';

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

// ─── Skip List ──────────────────────────────────────────────────────
// Pages excluded from auto-discovery validation with documented reasons.
// Every POST-containing page MUST be in MODULE_MAP, auto-validated,
// or listed here. This ensures no form page slips through unnoticed.

const SKIP_LIST: Record<string, string> = {
  // Authentication / system
  'src/app/login/page.tsx': 'Authentication page, not a data form',

  // Dashboards and read-only views
  'src/app/dashboard/page.tsx': 'Dashboard with no data creation',
  'src/app/dashboard/audit/page.tsx': 'Audit dashboard, read-only',

  // Test / dev pages
  'src/app/test/datebox/page.tsx': 'Dev test page',

  // VMI / sync trigger pages
  'src/app/vmi/sync/page.tsx': 'VMI sync trigger, not a data form',

  // Report design pages (special report builder, not standard data form)
  'src/app/reports/design/[code]/page.tsx': 'Report designer page, non-standard form',
  'src/app/reports/new/page.tsx': 'Report template creation, non-standard form',
  'src/app/reports/view/[code]/page.tsx': 'Report viewer, not a data form',

  // Pages that delegate forms to imported components (no useState/fetch in page.tsx itself)
  'src/app/gmp/complaints/new/page.tsx': 'Form delegated to ComplaintDataEntryDialog component',
  'src/app/gmp/recalls/new/page.tsx': 'Form delegated to RecallDataEntryDialog component',
  'src/app/gmp/capa/new/page.tsx': 'Form delegated to CapaDataEntryDialog component',
  'src/app/gmp/documents/new/page.tsx': 'Form delegated to DocumentDataEntryDialog component',
  'src/app/settings/approval-workflows/[id]/history/page.tsx': 'History view, not a data form',

  // Master data pages (CRUD forms with inline editing in DataGrid, not standard form)
  'src/app/master-data/production-equipment/page.tsx': 'DataGrid list page, no standalone form',
  'src/app/master-data/production-rooms/page.tsx': 'DataGrid list page, no standalone form',
  'src/app/master-data/environmental-conditions/page.tsx': 'DataGrid list page, no standalone form',
  'src/app/master-data/packaging-qc-criteria/page.tsx': 'DataGrid list page, no standalone form',
  'src/app/master-data/sop-templates/page.tsx': 'DataGrid list page, no standalone form',

  // Template module (uses extracted form components)
  'src/app/template/page.tsx': 'Template dashboard, no data form',
  'src/app/template/items/page.tsx': 'Template items list page',
  'src/app/template/categories/page.tsx': 'Template categories list page',

  // Issue tracker
  'src/app/issues/list/page.tsx': 'Issues list page with filter POST, not a data form',

  // Accounting action pages (approve/match/reconcile, not creation forms)
  'src/app/accounting/approvals/page.tsx': 'Approval action page, not a data creation form',
  'src/app/accounting/matching/page.tsx': 'Invoice matching action page, not creation form',
  'src/app/accounting/period-close/page.tsx': 'Period close action page, not creation form',
  'src/app/accounting/bank-reconciliation/reconcile/[id]/page.tsx': 'Reconciliation action page',

  // GMP pages with inline status updates (not creation forms)
  'src/app/gmp/stability/trends/page.tsx': 'Trends view page, not a data form',
  'src/app/gmp/complaints/trends/page.tsx': 'Trends view page, not a data form',

  // Settings pages
  'src/app/settings/workflow-test/page.tsx': 'Workflow test page, not production data',

  // Accounting pages using non-standard DB pattern (direct getDb() instead of getTableRef)
  'src/app/accounting/ap/invoices/page.tsx': 'Service uses getDb() pattern, not getTableRef()',
  'src/app/accounting/ap/payments/page.tsx': 'Service uses getDb() pattern, not getTableRef()',
  'src/app/accounting/ar/invoices/page.tsx': 'Service uses getDb() pattern, not getTableRef()',
  'src/app/accounting/chart-of-accounts/page.tsx': 'Service uses getDb() pattern, form in component',
  'src/app/accounting/journal-entries/page.tsx': 'Service uses getDb() pattern, form in component',

  // Admin pages with component-delegated forms
  'src/app/admin/confidential-groups/[id]/members/page.tsx': 'Form delegated to component',
  'src/app/admin/confidential-groups/page.tsx': 'Form delegated to component',

  // GMP pages with component-delegated forms or service-based APIs
  'src/app/gmp/capa/[id]/page.tsx': 'Detail/edit page, form delegated to component',
  'src/app/gmp/changes/[id]/page.tsx': 'Detail/edit page, form delegated to component',
  'src/app/gmp/changes/new/page.tsx': 'Form delegated to component',
  'src/app/gmp/complaints/[id]/page.tsx': 'Detail page, forms delegated to components',
  'src/app/gmp/documents/[id]/page.tsx': 'Detail/edit page, form delegated to component',
  'src/app/gmp/internal-audit/audits/[id]/page.tsx': 'Detail page, service-based API',
  'src/app/gmp/internal-audit/audits/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/internal-audit/findings/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/internal-audit/plans/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/recalls/[id]/page.tsx': 'Detail/edit page, form delegated to component',
  'src/app/gmp/recalls/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/sanitation/logs/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/sanitation/pest-control/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/sanitation/schedules/page.tsx': 'List with inline actions, service-based API',
  'src/app/gmp/stability/protocols/new/page.tsx': 'Service-based API without getTableRef',

  // HR pages with component-delegated forms
  'src/app/hr/authorizations/page.tsx': 'List with inline actions, service-based API',
  'src/app/hr/positions/page.tsx': 'List with inline actions, service-based API',

  // Production pages with complex multi-step forms
  'src/app/production/bom/[id]/configuration/page.tsx': 'BOM configuration, service-based API',
  'src/app/production/bom/[id]/page.tsx': 'BOM detail/edit, multiple sub-API calls',
  'src/app/production/label-verification/page.tsx': 'Verification action page, service-based API',
  'src/app/production/work-orders/[id]/cleaning/page.tsx': 'WO sub-step, service-based API',
  'src/app/production/work-orders/[id]/environmental-monitoring/page.tsx': 'WO sub-step, service-based API',
  'src/app/production/work-orders/[id]/finished-inspection/page.tsx': 'WO sub-step, service-based API',
  'src/app/production/work-orders/[id]/packaging-qc/page.tsx': 'WO sub-step, service-based API',
  'src/app/production/work-orders/[id]/sop-execution/page.tsx': 'WO sub-step, service-based API',

  // Quality test detail/edit page
  'src/app/quality/tests/[id]/page.tsx': 'Detail/edit page with result recording',

  // COA module pages (Phase 4 — service-based generation, not standard forms)
  'src/app/quality/coa/page.tsx': 'List page with filters, no data form',
  'src/app/quality/coa/[id]/page.tsx': 'Detail page with status actions, service-based API',

  // Sales pages
  'src/app/sales/orders/[id]/page.tsx': 'Detail page with delivery/fulfillment actions',
  'src/app/sales/vmi-orders/page.tsx': 'VMI order management, service-based API',
  'src/app/sales/vmi-orders/portals/[id]/webhooks/page.tsx': 'VMI webhook config, service-based API',

  // Settings
  'src/app/settings/vmi/[id]/page.tsx': 'VMI portal settings, service-based API',
};

// ─── Auto-Discovery Infrastructure ──────────────────────────────────

const MANUAL_MODULE_PAGES = new Set(MODULE_MAP.map(m => m.formPage));

interface AutoDiscoveredPage {
  filePath: string;
  apiUrl: string;
  apiRoutePath: string;
  schemaTable: string;
  stateVars: Array<{ varName: string; fields: Set<string> }>;
}

/** Recursively walk a directory and return all file paths. */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

/**
 * Find all page.tsx files that directly contain POST fetch calls.
 * Returns paths relative to ROOT.
 */
function discoverPostPages(): string[] {
  const appDir = resolve(ROOT, 'src/app');
  const allFiles = walkDir(appDir);

  return allFiles
    .filter(f => f.endsWith('page.tsx'))
    .map(f => relative(ROOT, f))
    .filter(filePath => {
      try {
        const content = readFileSync(resolve(ROOT, filePath), 'utf-8');
        return /method:\s*['"]POST['"]/.test(content) && /fetch\s*\(/.test(content);
      } catch {
        return false;
      }
    });
}

/**
 * Extract POST API URLs from a page's fetch calls.
 * Matches fetch('/api/...') or fetch(`/api/...`) where method: 'POST' appears nearby.
 */
function extractPostApiUrls(filePath: string): string[] {
  const content = readFileSync(resolve(ROOT, filePath), 'utf-8');
  const urls: string[] = [];

  // Match fetch('/api/xxx', { ... method: 'POST' ... })
  const fetchBlockPattern = /fetch\s*\(\s*(?:[`'"])(\/api\/[^`'"]+)(?:[`'"])\s*,\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let match;
  while ((match = fetchBlockPattern.exec(content)) !== null) {
    const url = match[1];
    const options = match[2];
    if (/method:\s*['"]POST['"]/.test(options)) {
      urls.push(url);
    }
  }

  // Fallback: find all /api/ URLs if POST exists in file
  if (urls.length === 0) {
    const urlPattern = /[`'"](\/api\/[^`'"$\s]+)[`'"]/g;
    const hasPost = /method:\s*['"]POST['"]/.test(content);
    if (hasPost) {
      while ((match = urlPattern.exec(content)) !== null) {
        urls.push(match[1]);
      }
    }
  }

  return [...new Set(urls)]; // dedupe
}

/**
 * Auto-detect all useState({...}) variable names and their field names.
 */
function autoDetectFormStateVars(filePath: string): Array<{ varName: string; fields: Set<string> }> {
  const content = readFileSync(resolve(ROOT, filePath), 'utf-8');
  const results: Array<{ varName: string; fields: Set<string> }> = [];

  const pattern = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState(?:<[^>]+>)?\(\{([\s\S]*?)\}\)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const varName = match[1];
    const body = match[2];
    const fields = new Set<string>();

    const fieldPattern = /^\s+(\w+)\s*:/gm;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(body)) !== null) {
      fields.add(fieldMatch[1]);
    }

    if (fields.size > 1) { // At least 2 fields to be a meaningful form state
      results.push({ varName, fields });
    }
  }

  return results;
}

/**
 * Convert an API URL path to a file system path.
 * e.g., '/api/inventory/lots' -> 'src/app/api/inventory/lots/route.ts'
 */
function apiUrlToFilePath(url: string): string | null {
  let cleanUrl = url.split('?')[0];
  cleanUrl = cleanUrl.replace(/\$\{[^}]+\}/g, '[id]');

  const routePath = `src/app${cleanUrl}/route.ts`;
  if (existsSync(resolve(ROOT, routePath))) {
    return routePath;
  }
  return null;
}

/**
 * Resolve a service import path to an actual file path.
 */
function resolveServicePath(importPath: string): string | null {
  const candidates = [
    `src/lib/services/${importPath}.ts`,
    `src/lib/services/${importPath}`,
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(ROOT, candidate))) {
      return candidate;
    }
  }
  return null;
}

/**
 * Extract the primary table name from an API route's getTableRef() calls.
 * Follows service imports if the route delegates to a service layer.
 */
function parseApiTableRef(apiRoutePath: string): string | null {
  try {
    const content = readFileSync(resolve(ROOT, apiRoutePath), 'utf-8');

    // 1. Find getTableRef in POST handler specifically
    const postIdx = content.indexOf('export async function POST');
    if (postIdx !== -1) {
      const postContent = content.slice(postIdx);
      const match = postContent.match(/getTableRef\(['"](\w+)['"]\)/);
      if (match) return match[1];
    }

    // 2. Any getTableRef in the file
    const directMatch = content.match(/getTableRef\(['"](\w+)['"]\)/);
    if (directMatch) return directMatch[1];

    // 3. Follow service imports
    const serviceImportPattern = /from\s+['"]@\/lib\/services\/([^'"]+)['"]/g;
    let impMatch;
    while ((impMatch = serviceImportPattern.exec(content)) !== null) {
      const servicePath = resolveServicePath(impMatch[1]);
      if (servicePath) {
        const serviceContent = readFileSync(resolve(ROOT, servicePath), 'utf-8');
        const tableMatch = serviceContent.match(/getTableRef\(['"](\w+)['"]\)/);
        if (tableMatch) return tableMatch[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract ALL table names from an API route (handles multi-table inserts).
 * Returns all getTableRef arguments found in the route or its service imports.
 */
function parseAllApiTableRefs(apiRoutePath: string): string[] {
  try {
    const content = readFileSync(resolve(ROOT, apiRoutePath), 'utf-8');
    const tableRefs: string[] = [];

    // Find all getTableRef calls in the file
    const pattern = /getTableRef\(['"](\w+)['"]\)/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      tableRefs.push(match[1]);
    }

    // Follow service imports
    if (tableRefs.length === 0) {
      const serviceImportPattern = /from\s+['"]@\/lib\/services\/([^'"]+)['"]/g;
      let impMatch;
      while ((impMatch = serviceImportPattern.exec(content)) !== null) {
        const servicePath = resolveServicePath(impMatch[1]);
        if (servicePath) {
          const serviceContent = readFileSync(resolve(ROOT, servicePath), 'utf-8');
          const servicePattern = /getTableRef\(['"](\w+)['"]\)/g;
          let sMatch;
          while ((sMatch = servicePattern.exec(serviceContent)) !== null) {
            tableRefs.push(sMatch[1]);
          }
        }
      }
    }

    return [...new Set(tableRefs)]; // dedupe
  } catch {
    return [];
  }
}

/**
 * Convert getTableRef camelCase name to PascalCase for schema lookup.
 * e.g., 'inventoryLots' -> 'InventoryLots'
 */
function tableRefToSchemaName(tableRef: string): string {
  return tableRef.charAt(0).toUpperCase() + tableRef.slice(1);
}

// ─── Compute Auto-Discovery at Module Load ──────────────────────────

const ALL_POST_PAGES = discoverPostPages();

const AUTO_DISCOVERED: AutoDiscoveredPage[] = [];
for (const page of ALL_POST_PAGES) {
  if (MANUAL_MODULE_PAGES.has(page) || SKIP_LIST[page]) continue;

  const apiUrls = extractPostApiUrls(page);
  const stateVars = autoDetectFormStateVars(page);

  // Need at least one POST API URL to validate
  if (apiUrls.length === 0) continue;

  for (const apiUrl of apiUrls) {
    const apiRoutePath = apiUrlToFilePath(apiUrl);
    if (!apiRoutePath) continue;

    const tableRef = parseApiTableRef(apiRoutePath);
    if (!tableRef) continue;

    const schemaTable = tableRefToSchemaName(tableRef);
    try {
      parseSchemaColumns(schemaTable);
      AUTO_DISCOVERED.push({ filePath: page, apiUrl, apiRoutePath, schemaTable, stateVars });
      break; // One auto-discovery per page is enough
    } catch {
      // Schema table not found, skip
    }
  }
}

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

  // ─── Auto-Discovered Form Validation ────────────────────────────────

  describe('Auto-Discovery Infrastructure', () => {
    it('should discover form pages with POST calls', () => {
      console.log(`  Total pages with POST fetch: ${ALL_POST_PAGES.length}`);
      console.log(`  Manual MODULE_MAP: ${MODULE_MAP.length} modules`);
      console.log(`  SKIP_LIST: ${Object.keys(SKIP_LIST).length} pages`);
      console.log(`  Auto-discovered: ${AUTO_DISCOVERED.length} pages`);
      expect(ALL_POST_PAGES.length).toBeGreaterThan(0);
    });

    it('should correctly extract API URLs from pages', () => {
      // Verify with known page
      const urls = extractPostApiUrls('src/app/inventory/lots/page.tsx');
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.some(u => u.includes('/api/inventory/lots'))).toBe(true);
    });

    it('should resolve API route file paths', () => {
      const path = apiUrlToFilePath('/api/inventory/lots');
      expect(path).toBe('src/app/api/inventory/lots/route.ts');
    });

    it('should extract table refs from API routes', () => {
      const tableRef = parseApiTableRef('src/app/api/inventory/lots/route.ts');
      expect(tableRef).toBe('inventoryLots');
    });

    it('should follow service imports for table refs', () => {
      // matching-tolerances route delegates to matching.service which uses getTableRef
      const tableRef = parseApiTableRef('src/app/api/settings/matching-tolerances/route.ts');
      expect(tableRef).not.toBeNull();
    });
  });

  // Dynamic tests for each auto-discovered page
  for (const disc of AUTO_DISCOVERED) {
    describe(`Auto: ${disc.filePath}`, () => {
      let schemaColumns: Set<string>;
      let apiBodyFields: Set<string>;
      let apiInsertFields: Set<string>;

      beforeAll(() => {
        schemaColumns = parseSchemaColumns(disc.schemaTable);
        apiBodyFields = parseApiBodyFields(disc.apiRoutePath);
        apiInsertFields = parseApiInsertFields(disc.apiRoutePath);
      });

      it('API insert fields should exist in DB schema (no insert errors)', () => {
        // Collect columns from ALL tables referenced in the API route (handles multi-table inserts)
        const allTableRefs = parseAllApiTableRefs(disc.apiRoutePath);
        let allColumns = new Set(schemaColumns);
        for (const ref of allTableRefs) {
          try {
            const cols = parseSchemaColumns(tableRefToSchemaName(ref));
            cols.forEach(c => allColumns.add(c));
          } catch { /* schema not found for this table, skip */ }
        }

        const systemFields = new Set(COMMON_DB_SYSTEM_FIELDS);
        const insertFieldsToCheck = setDifference(apiInsertFields, systemFields);
        const missingInSchema = setDifference(insertFieldsToCheck, allColumns);

        if (missingInSchema.size > 0) {
          const fieldList = [...missingInSchema].join(', ');
          throw new Error(
            `SCHEMA MISMATCH in ${disc.filePath}!\n` +
            `API route ${disc.apiRoutePath} tries to insert fields that don't exist in any referenced DB schema:\n` +
            `  Missing columns: ${fieldList}\n` +
            `  Tables checked: ${allTableRefs.map(t => tableRefToSchemaName(t)).join(', ')}\n` +
            `  Fix: Add these columns to the Drizzle schema definition.`
          );
        }
      });

      it('Form fields should be accepted by API POST', () => {
        for (const sv of disc.stateVars) {
          const missingInApi = setDifference(sv.fields, apiBodyFields);
          const missingInBoth = setDifference(missingInApi, apiInsertFields);

          if (missingInBoth.size > 0) {
            // Log as informational - auto-discovery doesn't have formOnlyFields exceptions
            console.log(
              `  [INFO] ${disc.filePath}: state "${sv.varName}" has fields not in API: ${[...missingInBoth].join(', ')}\n` +
              `         (Add to MODULE_MAP with formOnlyFields for strict validation)`
            );
          }
        }
        expect(true).toBe(true);
      });

      it('Form fields should have corresponding DB columns', () => {
        for (const sv of disc.stateVars) {
          const missingInSchema = setDifference(sv.fields, schemaColumns);

          if (missingInSchema.size > 0) {
            console.log(
              `  [INFO] ${disc.filePath}: state "${sv.varName}" fields not in schema: ${[...missingInSchema].join(', ')}\n` +
              `         (Add to MODULE_MAP with formOnlyFields for strict validation)`
            );
          }
        }
        expect(true).toBe(true);
      });

      it('should report auto-discovered field summary', () => {
        const stateFieldCount = disc.stateVars.reduce((sum, sv) => sum + sv.fields.size, 0);
        console.log(
          `  [${disc.filePath}] Table=${disc.schemaTable}, ` +
          `Schema=${schemaColumns.size} cols, ` +
          `API=${apiBodyFields.size} body + ${apiInsertFields.size} insert, ` +
          `Form=${stateFieldCount} fields`
        );
        expect(true).toBe(true);
      });
    });
  }

  // ─── Coverage Report ────────────────────────────────────────────────

  describe('Coverage Report', () => {
    it('should account for ALL form pages (no unvalidated pages)', () => {
      const unvalidated: Array<{ page: string; reason: string }> = [];

      for (const page of ALL_POST_PAGES) {
        if (MANUAL_MODULE_PAGES.has(page)) continue;
        if (SKIP_LIST[page]) continue;
        if (AUTO_DISCOVERED.some(d => d.filePath === page)) continue;

        // This page is unvalidated - determine why
        const apiUrls = extractPostApiUrls(page);
        const stateVars = autoDetectFormStateVars(page);

        let reason = '';
        if (apiUrls.length === 0) {
          reason = 'No /api/ URL found in fetch calls';
        } else if (stateVars.length === 0) {
          reason = 'No useState({...}) form state found (may use component-delegated form)';
        } else {
          const apiRoutePath = apiUrlToFilePath(apiUrls[0]);
          if (!apiRoutePath) {
            reason = `API route file not found for ${apiUrls[0]}`;
          } else {
            const tableRef = parseApiTableRef(apiRoutePath);
            if (!tableRef) {
              reason = `No getTableRef() found in ${apiRoutePath} or its service imports`;
            } else {
              reason = `Schema table "${tableRefToSchemaName(tableRef)}" not found in schema.ts`;
            }
          }
        }

        unvalidated.push({ page, reason });
      }

      // Log coverage summary
      const manualCount = [...ALL_POST_PAGES].filter(p => MANUAL_MODULE_PAGES.has(p)).length;
      const autoCount = AUTO_DISCOVERED.length;
      const skipCount = [...ALL_POST_PAGES].filter(p => SKIP_LIST[p]).length;

      console.log(`\n  Coverage Report:`);
      console.log(`    Total POST pages: ${ALL_POST_PAGES.length}`);
      console.log(`    Manual (MODULE_MAP): ${manualCount}`);
      console.log(`    Auto-discovered: ${autoCount}`);
      console.log(`    Skipped (SKIP_LIST): ${skipCount}`);
      console.log(`    Unvalidated: ${unvalidated.length}`);

      if (unvalidated.length > 0) {
        const details = unvalidated
          .map(u => `  ${u.page}\n    Reason: ${u.reason}`)
          .join('\n');
        throw new Error(
          `UNVALIDATED FORM PAGES DETECTED!\n` +
          `The following pages have POST forms but couldn't be auto-validated:\n\n` +
          `${details}\n\n` +
          `Action required - choose ONE:\n` +
          `  1. Add to MODULE_MAP (with formOnlyFields/apiAutoFields exceptions)\n` +
          `  2. Add to SKIP_LIST with reason (if it's not a data form)\n` +
          `  3. Fix the code to follow standard patterns`
        );
      }
    });
  });
});

// Export parsers for reuse in other tests
export {
  parseSchemaColumns,
  parseApiBodyFields,
  parseApiInsertFields,
  parseFormStateFields,
  parseInterfaceFields,
  MODULE_MAP,
  SKIP_LIST,
  AUTO_DISCOVERED,
  ALL_POST_PAGES,
  discoverPostPages,
  extractPostApiUrls,
  autoDetectFormStateVars,
  apiUrlToFilePath,
  parseApiTableRef,
};
