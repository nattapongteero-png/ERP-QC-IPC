/**
 * Master Data Module i18n Tests
 * Feature: 015-i18n, Phase 10M
 *
 * TDD Red Phase: Tests verify Master Data pages use i18n translations.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Test Configuration
// ============================================

// Only include pages that have been migrated to i18n.
// Sub-pages (environmental-conditions, packaging-qc-criteria, production-equipment,
// production-rooms, sop-templates) have NOT been migrated yet.
const MASTER_DATA_PAGES = [
  'src/app/master-data/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]masterData['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Master Data Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(MASTER_DATA_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(MASTER_DATA_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(MASTER_DATA_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai master-data translations', () => {
      const content = readFileContent('src/locales/th/masterData.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English master-data translations', () => {
      const content = readFileContent('src/locales/en/masterData.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation key completeness', () => {
    it('should have required master-data translation keys in Thai', () => {
      const content = readFileContent('src/locales/th/masterData.json');
      const translations = JSON.parse(content);
      
      expect(translations.page).toBeDefined();
      expect(translations.modules).toBeDefined();
      expect(translations.about).toBeDefined();
    });

    it('should have required master-data translation keys in English', () => {
      const content = readFileContent('src/locales/en/masterData.json');
      const translations = JSON.parse(content);
      
      expect(translations.page).toBeDefined();
      expect(translations.modules).toBeDefined();
      expect(translations.about).toBeDefined();
    });
  });
});
