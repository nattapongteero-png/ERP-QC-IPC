/**
 * Production Module i18n Tests
 * Feature: 015-i18n, Phase 10E
 *
 * TDD Red Phase: Tests verify Production pages use i18n translations.
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

const PRODUCTION_PAGES = [
  // Main page
  'src/app/production/page.tsx',
  // Top-level pages
  'src/app/production/label-verification/page.tsx',
  'src/app/production/line-clearance/page.tsx',
  // Batch Records sub-module
  'src/app/production/batch-records/page.tsx',
  'src/app/production/batch-records/[id]/page.tsx',
  // BOM sub-module
  'src/app/production/bom/page.tsx',
  'src/app/production/bom/new/page.tsx',
  'src/app/production/bom/[id]/page.tsx',
  'src/app/production/bom/[id]/configuration/page.tsx',
  // Work Orders sub-module
  'src/app/production/work-orders/page.tsx',
  'src/app/production/work-orders/new/page.tsx',
  'src/app/production/work-orders/[id]/page.tsx',
  'src/app/production/work-orders/[id]/cleaning/page.tsx',
  'src/app/production/work-orders/[id]/environmental-monitoring/page.tsx',
  'src/app/production/work-orders/[id]/execution/page.tsx',
  'src/app/production/work-orders/[id]/finished-inspection/page.tsx',
  'src/app/production/work-orders/[id]/material-weighing/page.tsx',
  'src/app/production/work-orders/[id]/packaging-qc/page.tsx',
  'src/app/production/work-orders/[id]/sop-execution/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]production['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  // Check for t('key') or t("key") patterns
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Production Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(PRODUCTION_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(PRODUCTION_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(PRODUCTION_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai production translations', () => {
      const content = readFileContent('src/locales/th/production.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });

    it('should have English production translations', () => {
      const content = readFileContent('src/locales/en/production.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });
  });

  describe('All pages exist', () => {
    it.each(PRODUCTION_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
