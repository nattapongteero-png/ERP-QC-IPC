/**
 * Quality Module i18n Tests
 * Feature: 015-i18n, Phase 10B
 *
 * TDD Red Phase: Tests verify Quality pages use i18n translations.
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

const QUALITY_PAGES = [
  // Main page
  'src/app/quality/page.tsx',
  // Deviations sub-module
  'src/app/quality/deviations/page.tsx',
  'src/app/quality/deviations/new/page.tsx',
  'src/app/quality/deviations/[id]/page.tsx',
  // Tests sub-module
  'src/app/quality/tests/page.tsx',
  'src/app/quality/tests/new/page.tsx',
  'src/app/quality/tests/[id]/page.tsx',
  // Specs sub-module
  'src/app/quality/specs/page.tsx',
  'src/app/quality/specs/new/page.tsx',
  'src/app/quality/specs/[id]/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]quality['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  // Check for t('key') or t("key") patterns
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Quality Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(QUALITY_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(QUALITY_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(QUALITY_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai quality translations', () => {
      const content = readFileContent('src/locales/th/quality.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });

    it('should have English quality translations', () => {
      const content = readFileContent('src/locales/en/quality.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });
  });

  describe('All pages exist', () => {
    it.each(QUALITY_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
