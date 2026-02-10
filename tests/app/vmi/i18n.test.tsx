/**
 * VMI Module i18n Tests
 * Feature: 015-i18n
 *
 * Tests verify VMI dashboard page uses i18n translations.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Test Configuration
// ============================================

const VMI_PAGES = [
  'src/app/vmi/page.tsx',
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
  return /const\s+t\s*=\s*useTranslations\s*\(\s*['"]vmi['"]\s*\)/.test(content);
}

function usesTranslationFunction(content: string): boolean {
  return /\bt\s*\(\s*['"][^'"]+['"]\s*\)/.test(content);
}

// ============================================
// Tests
// ============================================

describe('VMI Module i18n Integration', () => {
  describe('Import check', () => {
    it.each(VMI_PAGES)('should import useTranslations in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsImport(content)).toBe(true);
    });
  });

  describe('Hook declaration check', () => {
    it.each(VMI_PAGES)('should declare useTranslations hook in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(hasUseTranslationsHook(content)).toBe(true);
    });
  });

  describe('Translation function usage check', () => {
    it.each(VMI_PAGES)('should use t() translation function in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      expect(usesTranslationFunction(content)).toBe(true);
    });
  });

  describe('No hardcoded Thai strings', () => {
    it.each(VMI_PAGES)('should not have hardcoded Thai strings in %s', (pagePath) => {
      const content = readFileContent(pagePath);
      // Check for common Thai strings that should be translated
      const hardcodedThaiPatterns = [
        'จัดการ Sync',
        'ดูคำสั่งซื้อ',
        'เชื่อมต่อกับระบบโรงพยาบาล',
        'คำสั่งซื้อรอดำเนินการ',
        'คำสั่งซื้อเร่งด่วน',
        'รอยืนยัน',
        'ยืนยันแล้ว',
        'กำลังจัดเตรียม',
        'ส่งมอบแล้ว',
        'สถานะการ Sync',
        'สต็อกสินค้า',
        'รายการสินค้า',
        'ราคาสินค้า',
        'เชื่อมต่อโรงพยาบาล',
        'จัดการคำสั่งซื้อ',
        'จับคู่รหัสสินค้า',
        'รายการรอจับคู่สินค้า',
        'ไม่เคย',
        'เมื่อสักครู่',
        'สำเร็จ',
        'ล้มเหลว',
      ];

      for (const pattern of hardcodedThaiPatterns) {
        const regex = new RegExp(`['"\`>]${pattern}`, 'g');
        const matches = content.match(regex);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Translation file existence', () => {
    it('should have Thai vmi translations', () => {
      const content = readFileContent('src/locales/th/vmi.json');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have English vmi translations', () => {
      const content = readFileContent('src/locales/en/vmi.json');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Translation key completeness', () => {
    it('should have required vmi dashboard translation keys in Thai', () => {
      const content = readFileContent('src/locales/th/vmi.json');
      const translations = JSON.parse(content);

      expect(translations.dashboard).toBeDefined();
      expect(translations.dashboard.title).toBeDefined();
      expect(translations.dashboard.subtitle).toBeDefined();
      expect(translations.orderStatus).toBeDefined();
      expect(translations.syncStatus).toBeDefined();
      expect(translations.portals).toBeDefined();
      expect(translations.quickActions).toBeDefined();
      expect(translations.alerts).toBeDefined();
    });

    it('should have required vmi dashboard translation keys in English', () => {
      const content = readFileContent('src/locales/en/vmi.json');
      const translations = JSON.parse(content);

      expect(translations.dashboard).toBeDefined();
      expect(translations.dashboard.title).toBeDefined();
      expect(translations.dashboard.subtitle).toBeDefined();
      expect(translations.orderStatus).toBeDefined();
      expect(translations.syncStatus).toBeDefined();
      expect(translations.portals).toBeDefined();
      expect(translations.quickActions).toBeDefined();
      expect(translations.alerts).toBeDefined();
    });

    it('should have matching keys between Thai and English', () => {
      const thContent = JSON.parse(readFileContent('src/locales/th/vmi.json'));
      const enContent = JSON.parse(readFileContent('src/locales/en/vmi.json'));

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
