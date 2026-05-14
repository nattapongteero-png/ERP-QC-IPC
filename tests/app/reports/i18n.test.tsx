/**
 * Reports Module i18n Tests
 * Feature: 015-i18n
 *
 * Tests verify Reports page uses i18n translations.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Test Configuration
// ============================================

const REPORTS_PAGES = [
  'src/app/reports/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]reports['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Reports Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(REPORTS_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(REPORTS_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(REPORTS_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai reports translations', () => {
      const content = readFileContent('src/locales/th/reports.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English reports translations', () => {
      const content = readFileContent('src/locales/en/reports.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation key completeness', () => {
    it('should have required reports translation keys in Thai', () => {
      const content = readFileContent('src/locales/th/reports.json');
      const translations = JSON.parse(content);

      expect(translations.page).toBeDefined();
      expect(translations.page.title).toBeDefined();
      expect(translations.page.description).toBeDefined();
      expect(translations.actions.newReport).toBeDefined();
      expect(translations.actions.dismiss).toBeDefined();
      expect(translations.overview).toBeDefined();
      expect(translations.overview.title).toBeDefined();
      expect(translations.overview.totalTemplates).toBeDefined();
      expect(translations.overview.published).toBeDefined();
      expect(translations.overview.drafts).toBeDefined();
      expect(translations.overview.categories).toBeDefined();
      expect(translations.mobile).toBeDefined();
      expect(translations.mobile.filterByCategory).toBeDefined();
    });

    it('should have required reports translation keys in English', () => {
      const content = readFileContent('src/locales/en/reports.json');
      const translations = JSON.parse(content);

      expect(translations.page).toBeDefined();
      expect(translations.page.title).toBeDefined();
      expect(translations.page.description).toBeDefined();
      expect(translations.actions.newReport).toBeDefined();
      expect(translations.actions.dismiss).toBeDefined();
      expect(translations.overview).toBeDefined();
      expect(translations.overview.title).toBeDefined();
      expect(translations.overview.totalTemplates).toBeDefined();
      expect(translations.overview.published).toBeDefined();
      expect(translations.overview.drafts).toBeDefined();
      expect(translations.overview.categories).toBeDefined();
      expect(translations.mobile).toBeDefined();
      expect(translations.mobile.filterByCategory).toBeDefined();
    });
  });

  describe('No hardcoded strings', () => {
    it('should not have hardcoded UI strings in reports page', () => {
      const content = readFileContent('src/app/reports/page.tsx');
      // These strings should now be replaced with t() calls
      expect(content).not.toContain('title="Reports"');
      expect(content).not.toContain('"View, create, and manage report templates"');
      expect(content).not.toContain('text="New Report"');
      expect(content).not.toContain('>Dismiss<');
      expect(content).not.toContain('>Overview<');
      expect(content).not.toContain('>Total Templates<');
      expect(content).not.toContain('>Filter by Category<');
    });
  });
});
