/**
 * Navigation label translation helper.
 *
 * The sidebar nav array defines menu items with English strings such as
 *   name: "Inventory"
 *   name: "Work Orders"
 * Rather than refactor the hundreds of entries into i18n keys, we keep the
 * English as the lookup source and translate at render time using a mapping
 * table that references keys in src/locales/LOCALE/navigation.json.
 *
 * Benefits:
 *   - One-line call site: navLabel("Inventory", t) — no structure change
 *   - Gracefully degrades: returns English as-is if no mapping or translation
 *   - Easy to extend: add an entry to ENGLISH_TO_KEY + both JSON files
 *
 * Usage:
 *   const t = useTranslations("navigation");
 *   return <span>{navLabel(item.name, t)}</span>;
 */

type TranslateFn = (key: string) => string;

// English label to t() path under the "navigation" namespace.
// Keep grouped by module for easy scanning; new entries should also be
// added to src/locales/th/navigation.json and src/locales/en/navigation.json.
const ENGLISH_TO_KEY: Record<string, string> = {
  // Top-level modules
  'Dashboard': 'modules.dashboard',
  'Inventory': 'modules.inventory',
  'Production': 'modules.production',
  'Quality': 'modules.quality',
  'Premises': 'modules.premises',
  'GMP Compliance': 'modules.gmp',
  'Purchasing': 'modules.purchasing',
  'Sales': 'modules.sales',
  'Accounting': 'modules.accounting',
  'Cost Management': 'modules.cost',
  'VMI Portal': 'modules.vmi',
  'HR': 'modules.hr',
  'Template': 'modules.template',
  'Issues': 'modules.issues',
  'Reports': 'modules.reports',
  'Users': 'modules.users',
  'Admin': 'modules.admin',
  'Settings': 'modules.settings',

  // Inventory submenu
  'Items': 'inventory.items',
  'Lots': 'inventory.lots',
  'Warehouses': 'inventory.warehouses',
  'Goods Receipt (Warehouse)': 'inventory.goodsReceipt',
  'Material Requisitions': 'inventory.requisitions',
  'Transactions': 'inventory.transactions',
  'Returns Inbox': 'inventory.returnsInbox',
  'Expiry Alerts': 'inventory.expiryAlerts',

  // Production submenu
  'BOM/Recipes': 'production.bom',
  'Work Orders': 'production.workOrders',
  'Batch Records': 'production.batchRecords',
  'Extra Withdrawal (non-BOM)': 'production.materialWithdrawal',
  'Master Data': 'production.masterData',

  // Quality submenu
  'QC Entry': 'quality.qcEntry',
  'Incoming Inspection (QC)': 'quality.incomingInspection',
  'Certificate of Analysis': 'quality.coa',
  'COA Templates': 'quality.coaTemplates',
  'Test Panels': 'quality.testPanels',
  'Tests': 'quality.tests',
  'Specifications': 'quality.specs',
  'Deviations': 'quality.deviations',
  'QC Audit Trail': 'quality.auditTrail',

  // Premises submenu
  'Premises Overview': 'premises.overview',

  // GMP submenu
  'Documents': 'gmp.documents',
  'Changes': 'gmp.changes',
  'CAPA': 'gmp.capa',
  'Complaints': 'gmp.complaints',
  'Recalls': 'gmp.recalls',
  'Sanitation': 'gmp.sanitation',
  'Stability': 'gmp.stability',
  'Internal Audit': 'gmp.internalAudit',
  'Contracts': 'gmp.contracts',
  'PQR': 'gmp.pqr',

  // Purchasing submenu
  'Requisitions': 'purchasing.requisitions',
  'Purchase Orders': 'purchasing.orders',
  'Vendors': 'purchasing.vendors',

  // Sales submenu
  'Sales Orders': 'sales.orders',
  'VMI Orders': 'sales.vmiOrders',
  'Customers': 'sales.customers',

  // Accounting submenu
  'Chart of Accounts': 'accounting.chartOfAccounts',
  'Account Types': 'accounting.accountTypes',
  'Journal Entries': 'accounting.journalEntries',
  'AP Invoices': 'accounting.apInvoices',
  'AR Invoices': 'accounting.arInvoices',
  'Fixed Assets': 'accounting.fixedAssets',
  'Equipment': 'accounting.equipment',
  'Period Close': 'accounting.periodClose',
  'Bank Reconciliation': 'accounting.bankReconciliation',
  'Credit/Debit Notes': 'accounting.creditDebitNotes',
  '3-Way Matching': 'accounting.threeWayMatching',
  'Approvals': 'accounting.approvals',
  'Standard Costs': 'accounting.standardCosts',
  'Variance Reports': 'accounting.varianceReports',

  // Cost submenu
  'Landed Costs': 'cost.landedCosts',
  'Work Centers': 'cost.workCenters',
  'Cost Summary': 'cost.costSummary',

  // VMI submenu
  'Sync': 'vmi.sync',
  'Orders': 'vmi.orders',

  // HR submenu
  'Organization': 'hr.organization',
  'Employees': 'hr.employees',
  'Positions': 'hr.positions',
  'Training': 'hr.training',
  'Authorizations': 'hr.authorizations',
  'Health Records': 'hr.healthRecords',
  'Roles': 'hr.roles',
  'Notifications': 'hr.notifications',
  'Audit Trail': 'hr.auditTrail',

  // Issues submenu
  'All Issues': 'issues.allIssues',
  'Report Issue': 'issues.reportIssue',

  // Admin submenu
  'Confidential Groups': 'admin.confidentialGroups',

  // Settings submenu
  'General': 'settings.general',
  'Approval Workflows': 'settings.approvalWorkflows',
  'Matching Tolerances': 'settings.matchingTolerances',
  'Workflow Test': 'settings.workflowTest',
};

/**
 * Translate a nav menu label. Falls back to the English name if no mapping
 * exists, or if the translation key is missing from the locale file.
 */
export function navLabel(englishName: string, t: TranslateFn): string {
  const key = ENGLISH_TO_KEY[englishName];
  if (!key) return englishName;
  try {
    const translated = t(key);
    // next-intl returns the key itself when missing — fall back to English
    // in that case so the UI never shows raw keys to users.
    if (!translated || translated === key) return englishName;
    return translated;
  } catch {
    return englishName;
  }
}

// Exported for tests — allows verifying the mapping catalog is in sync
// with navigation.json files.
export { ENGLISH_TO_KEY as _ENGLISH_TO_KEY };
