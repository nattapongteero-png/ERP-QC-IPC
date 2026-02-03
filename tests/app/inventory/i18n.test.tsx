/**
 * Inventory Module i18n Tests
 * Feature: 015-i18n, Phase 10F
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const INVENTORY_PAGES = [
  'src/app/inventory/page.tsx',
  'src/app/inventory/expiry-alerts/page.tsx',
  'src/app/inventory/items/page.tsx',
  'src/app/inventory/items/[id]/page.tsx',
  'src/app/inventory/lots/page.tsx',
  'src/app/inventory/lots/[id]/page.tsx',
  'src/app/inventory/transactions/page.tsx',
  'src/app/inventory/warehouses/page.tsx',
  'src/app/inventory/warehouses/[id]/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]inventory['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

describe('Inventory Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(INVENTORY_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(INVENTORY_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(INVENTORY_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai inventory translations', () => {
      const content = readFileContent('src/locales/th/inventory.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English inventory translations', () => {
      const content = readFileContent('src/locales/en/inventory.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('All pages exist', () => {
    it.each(INVENTORY_PAGES)('page file should exist: %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
