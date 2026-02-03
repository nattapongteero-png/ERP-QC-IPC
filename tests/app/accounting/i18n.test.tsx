/**
 * Accounting Module i18n Tests
 * Feature: 015-i18n, Phase 10D
 *
 * TDD Red Phase: Tests verify Accounting pages use i18n translations.
 * Tests MUST fail initially as pages don't use translations yet.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Test Configuration
// ============================================

const ACCOUNTING_PAGES = [
  // Main page
  'src/app/accounting/page.tsx',
  // AP sub-module
  'src/app/accounting/ap/page.tsx',
  'src/app/accounting/ap/aging/page.tsx',
  'src/app/accounting/ap/invoices/page.tsx',
  'src/app/accounting/ap/payments/page.tsx',
  // AR sub-module
  'src/app/accounting/ar/page.tsx',
  'src/app/accounting/ar/aging/page.tsx',
  'src/app/accounting/ar/invoices/page.tsx',
  'src/app/accounting/ar/receipts/page.tsx',
  // Approvals
  'src/app/accounting/approvals/page.tsx',
  // Bank Reconciliation
  'src/app/accounting/bank-reconciliation/page.tsx',
  'src/app/accounting/bank-reconciliation/statements/new/page.tsx',
  'src/app/accounting/bank-reconciliation/statements/[id]/page.tsx',
  'src/app/accounting/bank-reconciliation/reconcile/[id]/page.tsx',
  // Chart of Accounts
  'src/app/accounting/chart-of-accounts/page.tsx',
  // Credit/Debit Notes
  'src/app/accounting/credit-debit-notes/page.tsx',
  'src/app/accounting/credit-debit-notes/new/page.tsx',
  'src/app/accounting/credit-debit-notes/[id]/page.tsx',
  'src/app/accounting/credit-notes/page.tsx',
  'src/app/accounting/credit-notes/new/page.tsx',
  'src/app/accounting/credit-notes/[id]/page.tsx',
  'src/app/accounting/debit-notes/page.tsx',
  'src/app/accounting/debit-notes/new/page.tsx',
  'src/app/accounting/debit-notes/[id]/page.tsx',
  // Equipment
  'src/app/accounting/equipment/page.tsx',
  'src/app/accounting/equipment/new/page.tsx',
  'src/app/accounting/equipment/[id]/page.tsx',
  // Fixed Assets
  'src/app/accounting/fixed-assets/page.tsx',
  'src/app/accounting/fixed-assets/new/page.tsx',
  'src/app/accounting/fixed-assets/[id]/page.tsx',
  // Journal Entries
  'src/app/accounting/journal-entries/page.tsx',
  'src/app/accounting/journal-entries/new/page.tsx',
  'src/app/accounting/journal-entries/[id]/page.tsx',
  // Matching
  'src/app/accounting/matching/page.tsx',
  // Period Close
  'src/app/accounting/period-close/page.tsx',
  // Reports
  'src/app/accounting/reports/page.tsx',
  'src/app/accounting/reports/balance-sheet/page.tsx',
  'src/app/accounting/reports/cash-flow/page.tsx',
  'src/app/accounting/reports/income-statement/page.tsx',
  'src/app/accounting/reports/trial-balance/page.tsx',
  'src/app/accounting/reports/vat/page.tsx',
  'src/app/accounting/reports/wht/page.tsx',
  // Standard Costs
  'src/app/accounting/standard-costs/page.tsx',
  // Variance Reports
  'src/app/accounting/variance-reports/page.tsx',
];

// ============================================
// Helper Functions
// ============================================

function readFileContent(filePath: string): string {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    return '';
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function hasUseTranslationsImport(content: string): boolean {
  return /import\s*{\s*[^}]*useTranslations[^}]*}\s*from\s*['"]next-intl['"]/.test(content);
}

function hasUseTranslationsHook(content: string): boolean {
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]accounting['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  // Check for t('key') or t("key") patterns
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Accounting Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(ACCOUNTING_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(ACCOUNTING_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(ACCOUNTING_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai accounting translations', () => {
      const content = readFileContent('src/locales/th/accounting.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });

    it('should have English accounting translations', () => {
      const content = readFileContent('src/locales/en/accounting.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });
  });

  describe('All pages exist', () => {
    it.each(ACCOUNTING_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
