/**
 * GMP Module i18n Tests
 * Feature: 015-i18n, Phase 10A
 *
 * TDD Red Phase: Tests verify GMP pages use i18n translations.
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

const GMP_PAGES = [
  // Stability sub-module
  'src/app/gmp/stability/page.tsx',
  'src/app/gmp/stability/studies/page.tsx',
  'src/app/gmp/stability/studies/[id]/page.tsx',
  'src/app/gmp/stability/trends/page.tsx',
  'src/app/gmp/stability/protocols/page.tsx',
  'src/app/gmp/stability/protocols/new/page.tsx',
  // CAPA sub-module
  'src/app/gmp/capa/page.tsx',
  'src/app/gmp/capa/new/page.tsx',
  'src/app/gmp/capa/[id]/page.tsx',
  // Complaints sub-module
  'src/app/gmp/complaints/page.tsx',
  'src/app/gmp/complaints/new/page.tsx',
  'src/app/gmp/complaints/[id]/page.tsx',
  'src/app/gmp/complaints/trends/page.tsx',
  // Documents sub-module
  'src/app/gmp/documents/page.tsx',
  'src/app/gmp/documents/new/page.tsx',
  'src/app/gmp/documents/[id]/page.tsx',
  // Internal Audit sub-module
  'src/app/gmp/internal-audit/page.tsx',
  'src/app/gmp/internal-audit/audits/page.tsx',
  'src/app/gmp/internal-audit/audits/[id]/page.tsx',
  'src/app/gmp/internal-audit/findings/page.tsx',
  'src/app/gmp/internal-audit/plans/page.tsx',
  // Recalls sub-module
  'src/app/gmp/recalls/page.tsx',
  'src/app/gmp/recalls/new/page.tsx',
  'src/app/gmp/recalls/[id]/page.tsx',
  // Sanitation sub-module moved to the Premises module (src/app/premises/sanitation/*)
  // Changes sub-module
  'src/app/gmp/changes/page.tsx',
  'src/app/gmp/changes/new/page.tsx',
  'src/app/gmp/changes/[id]/page.tsx',
  // Contracts sub-module
  'src/app/gmp/contracts/page.tsx',
  // PQR sub-module
  'src/app/gmp/pqr/page.tsx',
  'src/app/gmp/pqr/generate/page.tsx',
  'src/app/gmp/pqr/[id]/page.tsx',
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
  return /import\s+.*\{[^}]*useTranslations[^}]*\}.*from\s+['"]next-intl['"]/.test(content) ||
         /import\s+\{\s*useTranslations\s*\}\s+from\s+['"]next-intl['"]/.test(content);
}

function hasGmpNamespace(content: string): boolean {
  return /useTranslations\s*\(\s*['"]gmp['"]/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  // Check for t() or t('key') calls that indicate translation usage
  // Look for patterns like: t('key'), t("key"), or t(`key`)
  return /\bt\s*\(\s*['"`][^'"`]+['"`]/.test(content);
}

// ============================================
// Tests
// ============================================

describe('GMP Module i18n Integration', () => {
  describe('useTranslations import check', () => {
    it.each(GMP_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content).not.toBe(''); // File should exist
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('GMP namespace usage check', () => {
    it.each(GMP_PAGES)('should use gmp namespace in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasGmpNamespace(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(GMP_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });
});

describe('GMP Translation Files', () => {
  const LOCALES = ['th', 'en'];

  describe.each(LOCALES)('%s locale', (locale) => {
    const gmpJsonPath = `src/locales/${locale}/gmp.json`;

    it('should have gmp.json translation file', () => {
      const content = readFileContent(gmpJsonPath);
      expect(content).not.toBe('');
    });

    it('should have valid JSON structure', () => {
      const content = readFileContent(gmpJsonPath);
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have stability section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('stability');
    });

    it('should have capa section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('capa');
    });

    it('should have complaints section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('complaints');
    });

    it('should have documents section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('documents');
    });

    it('should have internalAudit section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('internalAudit');
    });

    it('should have recalls section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('recalls');
    });

    it('should have sanitation section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('sanitation');
    });

    it('should have changes section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('changes');
    });

    it('should have contracts section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('contracts');
    });

    it('should have pqr section', () => {
      const content = readFileContent(gmpJsonPath);
      const json = JSON.parse(content);
      expect(json).toHaveProperty('pqr');
    });
  });
});
