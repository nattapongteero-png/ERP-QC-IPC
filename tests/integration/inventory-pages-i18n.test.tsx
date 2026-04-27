/**
 * Integration Tests: Inventory Pages i18n
 *
 * Regression context: these inventory pages had hardcoded English labels
 * (transactions had 40+, expiry-alerts 30+, warehouses referenced missing
 * keys like "inventory.stats.total"). This file locks in the fix by
 * verifying each locale produces different text for the key user-facing
 * labels. It also guards against regressions where someone adds a new
 * key in code without updating both locale JSON files.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import thInventory from '../../src/locales/th/inventory.json';
import enInventory from '../../src/locales/en/inventory.json';

// --- Helpers ---------------------------------------------------------------

// Walk dot-notation path like "transactions.types.receive" into the JSON blob.
function resolveKey(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

// --- Warehouse stats.total regression --------------------------------------
//
// User report: "/inventory/warehouses shows raw 'inventory.stats.total' on
// screen". Root cause was that the `stats.total` key simply didn't exist
// in either locale JSON — next-intl then returns the key itself. These
// tests prevent that specific bug from coming back.

describe('Inventory — stats.total key (regression)', () => {
  it('has stats.total in English locale', () => {
    expect(resolveKey(enInventory, 'stats.total')).toBeDefined();
    expect(resolveKey(enInventory, 'stats.total')!.length).toBeGreaterThan(0);
  });

  it('has stats.total in Thai locale', () => {
    expect(resolveKey(thInventory, 'stats.total')).toBeDefined();
    expect(resolveKey(thInventory, 'stats.total')!.length).toBeGreaterThan(0);
  });

  it('Thai and English stats.total values differ', () => {
    const en = resolveKey(enInventory, 'stats.total');
    const th = resolveKey(thInventory, 'stats.total');
    expect(en).not.toBe(th);
  });
});

describe('Inventory — warehouses type column + all type variants (regression)', () => {
  // User reported "ประเภท" column header not changing when switching
  // locale. Column uses t('warehouses.table.columns.type'); each type
  // badge uses t(`warehouses.types.${translationKey}`).
  const typeKeys = ['all', 'rawMaterial', 'wip', 'finishedGoods', 'quarantine', 'rejected', 'coldStorage'];

  it('warehouses.table.columns.type exists in both locales', () => {
    expect(resolveKey(enInventory, 'warehouses.table.columns.type')).toBeDefined();
    expect(resolveKey(thInventory, 'warehouses.table.columns.type')).toBeDefined();
    expect(resolveKey(enInventory, 'warehouses.table.columns.type')).not.toBe(
      resolveKey(thInventory, 'warehouses.table.columns.type'),
    );
  });

  it.each(typeKeys)('warehouses.types.%s exists in both locales', (key) => {
    const enPath = `warehouses.types.${key}`;
    const thPath = `warehouses.types.${key}`;
    expect(resolveKey(enInventory, enPath)).toBeDefined();
    expect(resolveKey(thInventory, thPath)).toBeDefined();
  });
});

// --- Transactions page keys ------------------------------------------------

describe('Inventory — transactions page i18n keys', () => {
  const requiredKeys = [
    // Type filter tabs
    'transactions.types.all',
    'transactions.types.receive',
    'transactions.types.issue',
    'transactions.types.transfer',
    'transactions.types.adjust',
    'transactions.types.scrap',
    'transactions.types.return',
    // Reference types
    'transactions.refTypes.none',
    'transactions.refTypes.purchaseOrder',
    'transactions.refTypes.salesOrder',
    'transactions.refTypes.workOrder',
    'transactions.refTypes.qcRelease',
    'transactions.refTypes.adjustment',
    // DataGrid column headers
    'transactions.table.columns.transactionNumber',
    'transactions.table.columns.type',
    'transactions.table.columns.lotItem',
    'transactions.table.columns.quantity',
    'transactions.table.columns.warehouse',
    'transactions.table.columns.reference',
    'transactions.table.columns.dateBy',
    // StatCard labels
    'transactions.stats.total',
    'transactions.stats.incoming',
    'transactions.stats.outgoing',
    'transactions.stats.today',
    // Action buttons
    'transactions.actions.refresh',
    'transactions.actions.viewLots',
    'transactions.actions.newTransaction',
    'transactions.actions.apply',
    'transactions.actions.cancel',
    'transactions.actions.create',
    // Form modal
    'transactions.form.title',
    'transactions.form.transactionType',
    'transactions.form.selectLot',
    'transactions.form.selectLotPlaceholder',
    'transactions.form.selectWarehousePlaceholder',
    'transactions.form.quantity',
    'transactions.form.toWarehouse',
    'transactions.form.maxAvailable',
    'transactions.form.referenceSection',
    'transactions.form.referenceType',
    'transactions.form.referenceNumber',
    'transactions.form.referencePlaceholder',
    'transactions.form.notes',
    'transactions.form.notesPlaceholder',
    'transactions.form.lotInfo.item',
    'transactions.form.lotInfo.available',
    'transactions.form.lotInfo.warehouse',
    'transactions.form.alertSelectLotAndQty',
    // Search
    'transactions.search.placeholder',
    'transactions.search.fromDate',
    'transactions.search.toDate',
    // Empty / no-results
    'transactions.empty.title',
    'transactions.empty.description',
    'transactions.noResults.title',
    'transactions.noResults.description',
    'transactions.noDataText',
    // Mobile
    'transactions.mobile.lotPrefix',
  ];

  it.each(requiredKeys)('"%s" exists in English locale', (key) => {
    expect(resolveKey(enInventory, key)).toBeDefined();
  });

  it.each(requiredKeys)('"%s" exists in Thai locale', (key) => {
    expect(resolveKey(thInventory, key)).toBeDefined();
  });

  // Keys whose value is a brand/format hint and may legitimately be the same
  // string in both locales (e.g., document-number formats like "PO-2024-001").
  const SAME_IS_OK = new Set<string>([
    'transactions.form.referencePlaceholder',
  ]);
  const divergentKeys = requiredKeys.filter((k) => !SAME_IS_OK.has(k));

  it.each(divergentKeys)('"%s" differs between Thai and English', (key) => {
    const en = resolveKey(enInventory, key);
    const th = resolveKey(thInventory, key);
    expect(en).not.toBe(th);
  });
});

// --- Expiry Alerts page keys -----------------------------------------------

describe('Inventory — expiry-alerts page i18n keys', () => {
  const requiredKeys = [
    'expiryAlerts.pageTitle',
    'expiryAlerts.description',
    'expiryAlerts.refresh',
    // Day filter
    'expiryAlerts.daysOptions.next30',
    'expiryAlerts.daysOptions.next60',
    'expiryAlerts.daysOptions.next90',
    'expiryAlerts.daysOptions.next180',
    // Stat cards
    'expiryAlerts.stats.expiredLots',
    'expiryAlerts.stats.expiredValue',
    'expiryAlerts.stats.nearExpiryLots',
    'expiryAlerts.stats.nearExpiryValue',
    // DataGrid columns (shared between expired + near-expiry)
    'expiryAlerts.columns.lotNumber',
    'expiryAlerts.columns.itemCode',
    'expiryAlerts.columns.itemName',
    'expiryAlerts.columns.quantity',
    'expiryAlerts.columns.expiryDate',
    'expiryAlerts.columns.daysExpired',
    'expiryAlerts.columns.daysToExpiry',
    // Section headers (interpolated count/days stripped for lookup)
    'expiryAlerts.sections.expiredTitle',
    'expiryAlerts.sections.expiredDescription',
    'expiryAlerts.sections.nearExpiryTitle',
    'expiryAlerts.sections.nearExpiryDescription',
    // Badge suffixes
    'expiryAlerts.badge.daysAgo',
    'expiryAlerts.badge.daysLeft',
    // Mobile card labels
    'expiryAlerts.mobile.qty',
    'expiryAlerts.mobile.expired',
    'expiryAlerts.mobile.expires',
    // Empty states
    'expiryAlerts.noExpired',
    'expiryAlerts.noNearExpiry',
    'expiryAlerts.allClear.title',
    'expiryAlerts.allClear.description',
  ];

  it.each(requiredKeys)('"%s" exists in English locale', (key) => {
    expect(resolveKey(enInventory, key)).toBeDefined();
  });

  it.each(requiredKeys)('"%s" exists in Thai locale', (key) => {
    expect(resolveKey(thInventory, key)).toBeDefined();
  });

  it.each(requiredKeys)('"%s" differs between Thai and English', (key) => {
    const en = resolveKey(enInventory, key);
    const th = resolveKey(thInventory, key);
    expect(en).not.toBe(th);
  });
});

// --- Lots page validation keys ---------------------------------------------

describe('Inventory — lots form validation i18n', () => {
  const validationKeys = [
    'lots.validation.lotNumberRequired',
    'lots.validation.selectItem',
    'lots.validation.selectWarehouse',
    'lots.validation.quantityMin',
    'lots.validation.expiryDateRequired',
    'lots.validation.expiryDateFuture',
    'lots.validation.mfgBeforeExpiry',
    'lots.validation.costRequired',
  ];

  it.each(validationKeys)('"%s" exists in both locales and they differ', (key) => {
    const en = resolveKey(enInventory, key);
    const th = resolveKey(thInventory, key);
    expect(en).toBeDefined();
    expect(th).toBeDefined();
    expect(en).not.toBe(th);
  });
});
