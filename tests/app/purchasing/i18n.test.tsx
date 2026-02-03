/**
 * Purchasing Module i18n Tests
 * Feature: 015-i18n, Phase 10G
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PURCHASING_PAGES = [
  'src/app/purchasing/page.tsx',
  'src/app/purchasing/orders/page.tsx',
  'src/app/purchasing/orders/new/page.tsx',
  'src/app/purchasing/orders/[id]/page.tsx',
  'src/app/purchasing/requisitions/page.tsx',
  'src/app/purchasing/requisitions/new/page.tsx',
  'src/app/purchasing/requisitions/[id]/page.tsx',
  'src/app/purchasing/vendors/page.tsx',
  'src/app/purchasing/vendors/new/page.tsx',
  'src/app/purchasing/vendors/[id]/page.tsx',
  'src/app/purchasing/vmi/orders/page.tsx',
];

function readFileContent(filePath: string): string {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
}

function hasUseTranslationsImport(content: string): boolean {
  return /import\s*{\s*[^}]*useTranslations[^}]*}\s*from\s*['"]next-intl['"]/.test(content);
}

function hasUseTranslationsHook(content: string): boolean {
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]purchasing['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

describe('Purchasing Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(PURCHASING_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(PURCHASING_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(PURCHASING_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai purchasing translations', () => {
      const content = readFileContent('src/locales/th/purchasing.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English purchasing translations', () => {
      const content = readFileContent('src/locales/en/purchasing.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('All pages exist', () => {
    it.each(PURCHASING_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
