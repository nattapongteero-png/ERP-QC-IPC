/**
 * i18n Configuration Tests
 * Feature: 015-i18n
 *
 * Tests for the i18n configuration module.
 */

import { describe, it, expect } from 'vitest';
import {
  locales,
  defaultLocale,
  fallbackLocale,
  localeNames,
  localeFlags,
  namespaces,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  LOCALE_COOKIE_EXPIRY,
  isValidLocale,
  getLocaleName,
  getLocaleWithFlag,
  type Locale,
  type Namespace,
} from '@/lib/i18n/config';

describe('i18n Configuration', () => {
  describe('locales', () => {
    it('should include Thai and English', () => {
      expect(locales).toContain('th');
      expect(locales).toContain('en');
    });

    it('should have exactly 2 locales', () => {
      expect(locales.length).toBe(2);
    });

    it('should be a readonly array', () => {
      // Type check - locales should be readonly
      const _typeCheck: readonly string[] = locales;
      expect(_typeCheck).toBeDefined();
    });
  });

  describe('defaultLocale', () => {
    it('should be Thai', () => {
      expect(defaultLocale).toBe('th');
    });

    it('should be a valid locale', () => {
      expect(locales).toContain(defaultLocale);
    });
  });

  describe('fallbackLocale', () => {
    it('should be Thai (for fallback when English translation is missing)', () => {
      expect(fallbackLocale).toBe('th');
    });

    it('should be a valid locale', () => {
      expect(locales).toContain(fallbackLocale);
    });
  });

  describe('localeNames', () => {
    it('should have Thai name for th locale', () => {
      expect(localeNames.th).toBe('ไทย');
    });

    it('should have English name for en locale', () => {
      expect(localeNames.en).toBe('English');
    });

    it('should have names for all locales', () => {
      locales.forEach((locale) => {
        expect(localeNames[locale]).toBeDefined();
        expect(typeof localeNames[locale]).toBe('string');
        expect(localeNames[locale].length).toBeGreaterThan(0);
      });
    });
  });

  describe('localeFlags', () => {
    it('should have Thai flag for th locale', () => {
      expect(localeFlags.th).toBe('🇹🇭');
    });

    it('should have UK flag for en locale', () => {
      expect(localeFlags.en).toBe('🇬🇧');
    });

    it('should have flags for all locales', () => {
      locales.forEach((locale) => {
        expect(localeFlags[locale]).toBeDefined();
        expect(typeof localeFlags[locale]).toBe('string');
      });
    });
  });

  describe('namespaces', () => {
    it('should include common namespace', () => {
      expect(namespaces).toContain('common');
    });

    it('should include navigation namespace', () => {
      expect(namespaces).toContain('navigation');
    });

    it('should include devextreme namespace', () => {
      expect(namespaces).toContain('devextreme');
    });

    it('should include module-specific namespaces', () => {
      const moduleNamespaces = [
        'accounting',
        'dashboard',
        'hr',
        'inventory',
        'production',
        'purchasing',
        'quality',
        'sales',
      ];

      moduleNamespaces.forEach((ns) => {
        expect(namespaces).toContain(ns);
      });
    });
  });

  describe('constants', () => {
    it('should have correct cookie name', () => {
      expect(LOCALE_COOKIE_NAME).toBe('locale');
    });

    it('should have correct storage key', () => {
      expect(LOCALE_STORAGE_KEY).toBe('i18n-locale');
    });

    it('should have 1 year cookie expiry', () => {
      expect(LOCALE_COOKIE_EXPIRY).toBe(365);
    });
  });

  describe('isValidLocale', () => {
    it('should return true for Thai', () => {
      expect(isValidLocale('th')).toBe(true);
    });

    it('should return true for English', () => {
      expect(isValidLocale('en')).toBe(true);
    });

    it('should return false for unsupported locales', () => {
      expect(isValidLocale('fr')).toBe(false);
      expect(isValidLocale('de')).toBe(false);
      expect(isValidLocale('ja')).toBe(false);
      expect(isValidLocale('zh')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidLocale('')).toBe(false);
    });

    it('should return false for invalid values', () => {
      expect(isValidLocale('invalid')).toBe(false);
      expect(isValidLocale('TH')).toBe(false); // Case sensitive
      expect(isValidLocale('EN')).toBe(false);
    });

    it('should act as a type guard', () => {
      const value = 'th';
      if (isValidLocale(value)) {
        // TypeScript should recognize value as Locale here
        const locale: Locale = value;
        expect(locale).toBe('th');
      }
    });
  });

  describe('getLocaleName', () => {
    it('should return Thai name for th locale', () => {
      expect(getLocaleName('th')).toBe('ไทย');
    });

    it('should return English name for en locale', () => {
      expect(getLocaleName('en')).toBe('English');
    });
  });

  describe('getLocaleWithFlag', () => {
    it('should return Thai flag with name', () => {
      expect(getLocaleWithFlag('th')).toBe('🇹🇭 ไทย');
    });

    it('should return UK flag with English name', () => {
      expect(getLocaleWithFlag('en')).toBe('🇬🇧 English');
    });

    it('should format correctly for all locales', () => {
      locales.forEach((locale) => {
        const result = getLocaleWithFlag(locale);
        expect(result).toContain(localeFlags[locale]);
        expect(result).toContain(localeNames[locale]);
      });
    });
  });

  describe('Type definitions', () => {
    it('Locale type should be "th" | "en"', () => {
      // Type check - these should compile without errors
      const thLocale: Locale = 'th';
      const enLocale: Locale = 'en';
      expect(thLocale).toBe('th');
      expect(enLocale).toBe('en');
    });

    it('Namespace type should include common namespaces', () => {
      // Type check - these should compile without errors
      const commonNs: Namespace = 'common';
      const navNs: Namespace = 'navigation';
      expect(commonNs).toBe('common');
      expect(navNs).toBe('navigation');
    });
  });
});
