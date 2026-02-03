/**
 * @file missing-keys.test.ts
 * @description TDD Red phase test - verifies all required translation keys exist in both Thai and English.
 * This test is designed to FAIL initially (confirming missing keys) and PASS after T054-T057 add them.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Helper to load translation JSON file
 */
function loadTranslations(locale: string, namespace: string): Record<string, unknown> {
  const filePath = join(process.cwd(), 'src', 'locales', locale, `${namespace}.json`);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Helper to check if a nested key exists in an object
 */
function hasKey(obj: Record<string, unknown>, key: string): boolean {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined;
}

describe('Missing Translation Keys (T053)', () => {
  describe('accounting.json - Chart of Accounts keys', () => {
    const requiredKeys = [
      'chartOfAccounts.actions.label',
      'chartOfAccounts.actions.add',
    ];

    it.each(requiredKeys)('should have key "%s" in Thai', (key) => {
      const translations = loadTranslations('th', 'accounting');
      expect(hasKey(translations, key)).toBe(true);
    });

    it.each(requiredKeys)('should have key "%s" in English', (key) => {
      const translations = loadTranslations('en', 'accounting');
      expect(hasKey(translations, key)).toBe(true);
    });
  });

  describe('dashboard.json - Audit page keys', () => {
    const requiredKeys = [
      'error',
      'retry',
      'lastUpdated',
      'sections.rawMaterials',
      'sections.qualityProduction',
      'tables.expiryAlerts.title',
      'tables.expiryAlerts.lotNumber',
      'tables.expiryAlerts.item',
      'tables.expiryAlerts.daysLeft',
      'tables.expiryAlerts.expired',
      'tables.expiryAlerts.daysRemaining',
      'tables.lowStock.title',
      'tables.lowStock.code',
      'tables.lowStock.item',
      'tables.lowStock.onHand',
      'tables.lowStock.minStock',
    ];

    it.each(requiredKeys)('should have key "%s" in Thai', (key) => {
      const translations = loadTranslations('th', 'dashboard');
      expect(hasKey(translations, key)).toBe(true);
    });

    it.each(requiredKeys)('should have key "%s" in English', (key) => {
      const translations = loadTranslations('en', 'dashboard');
      expect(hasKey(translations, key)).toBe(true);
    });
  });

  describe('purchasing.json - Orders keys', () => {
    const requiredKeys = [
      'orders.grid.columns.poNumber',
      'orders.grid.columns.vendor',
      'orders.grid.columns.expectedDate',
      'orders.actions.createPO',
      'orders.stats.pending',
      'orders.stats.awaiting',
    ];

    it.each(requiredKeys)('should have key "%s" in Thai', (key) => {
      const translations = loadTranslations('th', 'purchasing');
      expect(hasKey(translations, key)).toBe(true);
    });

    it.each(requiredKeys)('should have key "%s" in English', (key) => {
      const translations = loadTranslations('en', 'purchasing');
      expect(hasKey(translations, key)).toBe(true);
    });
  });

  describe('sales.json - Order detail error keys', () => {
    const requiredKeys = [
      'orders.detail.error.lotStatus.title',
      'orders.detail.error.lotStatus.message',
      'orders.detail.error.lotStatus.suggestion1',
      'orders.detail.error.lotStatus.suggestion2',
    ];

    it.each(requiredKeys)('should have key "%s" in Thai', (key) => {
      const translations = loadTranslations('th', 'sales');
      expect(hasKey(translations, key)).toBe(true);
    });

    it.each(requiredKeys)('should have key "%s" in English', (key) => {
      const translations = loadTranslations('en', 'sales');
      expect(hasKey(translations, key)).toBe(true);
    });
  });
});
