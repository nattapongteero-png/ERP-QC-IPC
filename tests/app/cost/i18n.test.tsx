/**
 * Cost Module i18n Tests
 * Feature: 015-i18n, Phase 10I
 *
 * TDD Red Phase: Tests verify Cost pages use i18n translations.
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

const COST_PAGES = [
  // Main page
  'src/app/cost/page.tsx',
  // Landed Costs sub-module
  'src/app/cost/landed-costs/page.tsx',
  // Work Centers sub-module
  'src/app/cost/work-centers/page.tsx',
  // Reports sub-module
  'src/app/cost/reports/cost-summary/page.tsx',
];

// Wrapper pages that just render forms - minimal UI text
const COST_WRAPPER_PAGES = [
  'src/app/cost/landed-costs/new/page.tsx',
  'src/app/cost/landed-costs/[id]/page.tsx',
  'src/app/cost/work-centers/new/page.tsx',
  'src/app/cost/work-centers/[id]/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]cost['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  // Check for t('key') or t("key") patterns
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Cost Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(COST_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(COST_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(COST_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai cost translations', () => {
      const content = readFileContent('src/locales/th/cost.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English cost translations', () => {
      const content = readFileContent('src/locales/en/cost.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation key completeness', () => {
    it('should have required cost translation keys in Thai', () => {
      const content = readFileContent('src/locales/th/cost.json');
      const translations = JSON.parse(content);
      
      expect(translations.page).toBeDefined();
      expect(translations.dashboard).toBeDefined();
      expect(translations.landedCosts).toBeDefined();
      expect(translations.workCenters).toBeDefined();
    });

    it('should have required cost translation keys in English', () => {
      const content = readFileContent('src/locales/en/cost.json');
      const translations = JSON.parse(content);
      
      expect(translations.page).toBeDefined();
      expect(translations.dashboard).toBeDefined();
      expect(translations.landedCosts).toBeDefined();
      expect(translations.workCenters).toBeDefined();
    });
  });
});
