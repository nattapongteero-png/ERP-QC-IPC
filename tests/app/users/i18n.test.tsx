/**
 * Users Module i18n Tests
 * Feature: 015-i18n
 *
 * Tests verify Users page uses i18n translations.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Test Configuration
// ============================================

const USERS_PAGES = [
  'src/app/users/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]users['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('Users Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(USERS_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(USERS_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(USERS_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('No hardcoded Thai strings', () => {
    it.each(USERS_PAGES)('should not have hardcoded Thai strings in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      // Check for common Thai strings that should be translated
      const hardcodedThaiPatterns = [
        'ทุกบทบาท',
        'ผู้ดูแลระบบ',
        'จัดการผู้ใช้งาน',
        'เพิ่มผู้ใช้',
        'ค้นหาชื่อ',
        'ทั้งหมด',
        'ใช้งาน',
        'ปิดใช้งาน',
        'ผู้ใช้ทั้งหมด',
        'การกระจายตามบทบาท',
        'ไม่พบผู้ใช้งาน',
      ];

      for (const pattern of hardcodedThaiPatterns) {
        // Match Thai text in JSX or string literals, not in comments
        const regex = new RegExp(`['"\`>]${pattern}`, 'g');
        const matches = content.match(regex);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai users translations', () => {
      const content = readFileContent('src/locales/th/users.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English users translations', () => {
      const content = readFileContent('src/locales/en/users.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation key completeness', () => {
    it('should have required users translation keys in Thai', () => {
      const content = readFileContent('src/locales/th/users.json');
      const translations = JSON.parse(content);

      expect(translations.page).toBeDefined();
      expect(translations.page.title).toBeDefined();
      expect(translations.page.description).toBeDefined();
      expect(translations.actions).toBeDefined();
      expect(translations.summary).toBeDefined();
      expect(translations.tabs).toBeDefined();
      expect(translations.grid).toBeDefined();
      expect(translations.roles).toBeDefined();
      expect(translations.distribution).toBeDefined();
      expect(translations.search).toBeDefined();
      expect(translations.empty).toBeDefined();
    });

    it('should have required users translation keys in English', () => {
      const content = readFileContent('src/locales/en/users.json');
      const translations = JSON.parse(content);

      expect(translations.page).toBeDefined();
      expect(translations.page.title).toBeDefined();
      expect(translations.page.description).toBeDefined();
      expect(translations.actions).toBeDefined();
      expect(translations.summary).toBeDefined();
      expect(translations.tabs).toBeDefined();
      expect(translations.grid).toBeDefined();
      expect(translations.roles).toBeDefined();
      expect(translations.distribution).toBeDefined();
      expect(translations.search).toBeDefined();
      expect(translations.empty).toBeDefined();
    });

    it('should have matching keys between Thai and English', () => {
      const thContent = JSON.parse(readFileContent('src/locales/th/users.json'));
      const enContent = JSON.parse(readFileContent('src/locales/en/users.json'));

      const getKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
        const keys: string[] = [];
        for (const key in obj) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys.push(...getKeys(obj[key] as Record<string, unknown>, fullKey));
          } else {
            keys.push(fullKey);
          }
        }
        return keys;
      };

      const thKeys = getKeys(thContent).sort();
      const enKeys = getKeys(enContent).sort();
      expect(thKeys).toEqual(enKeys);
    });
  });
});
