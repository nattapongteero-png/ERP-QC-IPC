/**
 * HR Module i18n Tests
 * Feature: 015-i18n, Phase 10C
 *
 * TDD Red Phase: Tests verify HR pages use i18n translations.
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

const HR_PAGES = [
  // Main page
  'src/app/hr/page.tsx',
  // Top-level pages
  'src/app/hr/audit/page.tsx',
  'src/app/hr/notifications/page.tsx',
  'src/app/hr/org-chart/page.tsx',
  'src/app/hr/org/page.tsx',
  // Authorizations sub-module
  'src/app/hr/authorizations/page.tsx',
  'src/app/hr/authorizations/new/page.tsx',
  'src/app/hr/authorizations/[id]/page.tsx',
  // Employees sub-module
  'src/app/hr/employees/page.tsx',
  'src/app/hr/employees/new/page.tsx',
  'src/app/hr/employees/[id]/page.tsx',
  'src/app/hr/employees/[id]/edit/page.tsx',
  // Health Records sub-module
  'src/app/hr/health-records/page.tsx',
  'src/app/hr/health-records/new/page.tsx',
  'src/app/hr/health-records/[id]/page.tsx',
  // Positions sub-module
  'src/app/hr/positions/page.tsx',
  'src/app/hr/positions/new/page.tsx',
  'src/app/hr/positions/[id]/page.tsx',
  // Roles sub-module
  'src/app/hr/roles/page.tsx',
  'src/app/hr/roles/new/page.tsx',
  'src/app/hr/roles/[id]/page.tsx',
  // Training sub-module
  'src/app/hr/training/page.tsx',
  'src/app/hr/training/matrix/page.tsx',
  'src/app/hr/training/sessions/page.tsx',
  'src/app/hr/training/sessions/new/page.tsx',
  'src/app/hr/training/courses/page.tsx',
  'src/app/hr/training/courses/new/page.tsx',
  'src/app/hr/training/courses/[id]/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]hr['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  // Check for t('key') or t("key") patterns
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('HR Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(HR_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(HR_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(HR_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai hr translations', () => {
      const content = readFileContent('src/locales/th/hr.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });

    it('should have English hr translations', () => {
      const content = readFileContent('src/locales/en/hr.json');
      expect(content.length).toBeGreaterThan(0);
      const json = JSON.parse(content);
      expect(json).toBeDefined();
    });
  });

  describe('All pages exist', () => {
    it.each(HR_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
