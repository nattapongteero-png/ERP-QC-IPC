/**
 * Sales Module i18n Tests
 * Feature: 015-i18n, Phase 10H
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SALES_PAGES = [
  'src/app/sales/page.tsx',
  'src/app/sales/customers/page.tsx',
  'src/app/sales/customers/new/page.tsx',
  'src/app/sales/customers/[id]/page.tsx',
  'src/app/sales/orders/page.tsx',
  'src/app/sales/orders/new/page.tsx',
  'src/app/sales/orders/[id]/page.tsx',
  'src/app/sales/vmi-orders/page.tsx',
  'src/app/sales/vmi-orders/portals/[id]/webhooks/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]sales['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

describe('Sales Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(SALES_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(SALES_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(SALES_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai sales translations', () => {
      const content = readFileContent('src/locales/th/sales.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English sales translations', () => {
      const content = readFileContent('src/locales/en/sales.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('All pages exist', () => {
    it.each(SALES_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
