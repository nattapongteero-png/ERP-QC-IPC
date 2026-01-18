/**
 * Unit tests for i18n validation script
 *
 * Tests the translation validation logic that detects:
 * - Missing translation keys in locale files
 * - Inconsistent keys across locales
 * - Key extraction from source files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Types for validation
interface ValidationError {
  key: string;
  file: string;
  line: number;
  locale: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  success: boolean;
  missingKeys: ValidationError[];
  inconsistentKeys: ValidationError[];
  summary: {
    totalKeysUsed: number;
    totalKeysDefined: Record<string, number>;
    missingCount: number;
    coveragePercent: Record<string, number>;
  };
}

// Helper function to extract translation keys from source code
function extractTranslationKeys(content: string, _filePath: string): Array<{ key: string; line: number }> {
  const keys: Array<{ key: string; line: number }> = [];
  const lines = content.split('\n');

  // Match t('key'), t("key"), t(`key`)
  const tFunctionRegex = /\bt\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,|\))/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = tFunctionRegex.exec(line)) !== null) {
      keys.push({ key: match[1], line: index + 1 });
    }
    // Reset lastIndex for each line
    tFunctionRegex.lastIndex = 0;
  });

  return keys;
}

// Helper function to get nested value from object
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// Helper function to validate translations
function validateTranslations(
  usedKeys: Array<{ key: string; file: string; line: number }>,
  translations: Record<string, Record<string, unknown>>,
  locales: string[]
): ValidationResult {
  const missingKeys: ValidationError[] = [];
  const inconsistentKeys: ValidationError[] = [];

  // Get all defined keys per locale
  const definedKeysPerLocale: Record<string, Set<string>> = {};
  for (const locale of locales) {
    definedKeysPerLocale[locale] = new Set();
    const flatKeys = flattenObject(translations[locale] || {});
    Object.keys(flatKeys).forEach((k) => definedKeysPerLocale[locale].add(k));
  }

  // Check each used key against all locales
  const checkedKeys = new Set<string>();
  for (const { key, file, line } of usedKeys) {
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);

    for (const locale of locales) {
      const value = getNestedValue(translations[locale] || {}, key);
      if (value === undefined) {
        missingKeys.push({
          key,
          file,
          line,
          locale,
          severity: 'error',
        });
      }
    }
  }

  // Check for inconsistent keys (present in some locales but not all)
  const allDefinedKeys = new Set<string>();
  for (const locale of locales) {
    definedKeysPerLocale[locale].forEach((k) => allDefinedKeys.add(k));
  }

  for (const key of allDefinedKeys) {
    const missingInLocales = locales.filter((locale) => !definedKeysPerLocale[locale].has(key));
    if (missingInLocales.length > 0 && missingInLocales.length < locales.length) {
      for (const locale of missingInLocales) {
        inconsistentKeys.push({
          key,
          file: `src/locales/${locale}/`,
          line: 0,
          locale,
          severity: 'warning',
        });
      }
    }
  }

  // Calculate summary
  const totalKeysDefined: Record<string, number> = {};
  const coveragePercent: Record<string, number> = {};
  for (const locale of locales) {
    totalKeysDefined[locale] = definedKeysPerLocale[locale].size;
    const usedKeysCount = checkedKeys.size;
    const definedCount = definedKeysPerLocale[locale].size;
    coveragePercent[locale] = usedKeysCount > 0 ? Math.round((definedCount / usedKeysCount) * 100) : 100;
  }

  return {
    success: missingKeys.length === 0,
    missingKeys,
    inconsistentKeys,
    summary: {
      totalKeysUsed: checkedKeys.size,
      totalKeysDefined,
      missingCount: missingKeys.length,
      coveragePercent,
    },
  };
}

// Helper to flatten nested object to dot notation
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = String(value);
    }
  }

  return result;
}

describe('i18n Validation Script', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('extractTranslationKeys', () => {
    it('should extract keys from t() function calls with single quotes', () => {
      const content = `
        const label = t('actions.save');
        const message = t('errors.generic');
      `;
      const keys = extractTranslationKeys(content, 'test.tsx');

      expect(keys).toHaveLength(2);
      expect(keys[0]).toEqual({ key: 'actions.save', line: 2 });
      expect(keys[1]).toEqual({ key: 'errors.generic', line: 3 });
    });

    it('should extract keys from t() function calls with double quotes', () => {
      const content = `
        const label = t("actions.cancel");
      `;
      const keys = extractTranslationKeys(content, 'test.tsx');

      expect(keys).toHaveLength(1);
      expect(keys[0]).toEqual({ key: 'actions.cancel', line: 2 });
    });

    it('should extract keys from t() function calls with template literals', () => {
      const content = `
        const label = t(\`status.active\`);
      `;
      const keys = extractTranslationKeys(content, 'test.tsx');

      expect(keys).toHaveLength(1);
      expect(keys[0]).toEqual({ key: 'status.active', line: 2 });
    });

    it('should extract keys with interpolation parameters', () => {
      const content = `
        const message = t('validation.minLength', { min: 5 });
      `;
      const keys = extractTranslationKeys(content, 'test.tsx');

      expect(keys).toHaveLength(1);
      expect(keys[0]).toEqual({ key: 'validation.minLength', line: 2 });
    });

    it('should handle multiple keys on the same line', () => {
      const content = `const text = condition ? t('actions.save') : t('actions.cancel');`;
      const keys = extractTranslationKeys(content, 'test.tsx');

      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.key)).toContain('actions.save');
      expect(keys.map((k) => k.key)).toContain('actions.cancel');
    });

    it('should return empty array for content with no translation keys', () => {
      const content = `
        const value = 'Hello World';
        console.log(value);
      `;
      const keys = extractTranslationKeys(content, 'test.tsx');

      expect(keys).toHaveLength(0);
    });
  });

  describe('getNestedValue', () => {
    it('should retrieve deeply nested values', () => {
      const obj = {
        actions: {
          save: 'Save',
          nested: {
            deep: 'Deep Value',
          },
        },
      };

      expect(getNestedValue(obj, 'actions.save')).toBe('Save');
      expect(getNestedValue(obj, 'actions.nested.deep')).toBe('Deep Value');
    });

    it('should return undefined for missing keys', () => {
      const obj = {
        actions: { save: 'Save' },
      };

      expect(getNestedValue(obj, 'actions.missing')).toBeUndefined();
      expect(getNestedValue(obj, 'missing.key')).toBeUndefined();
    });

    it('should handle empty objects', () => {
      expect(getNestedValue({}, 'any.key')).toBeUndefined();
    });
  });

  describe('validateTranslations', () => {
    it('should return success when all keys are present in all locales', () => {
      const usedKeys = [
        { key: 'actions.save', file: 'test.tsx', line: 1 },
        { key: 'actions.cancel', file: 'test.tsx', line: 2 },
      ];

      const translations = {
        th: { actions: { save: 'บันทึก', cancel: 'ยกเลิก' } },
        en: { actions: { save: 'Save', cancel: 'Cancel' } },
      };

      const result = validateTranslations(usedKeys, translations, ['th', 'en']);

      expect(result.success).toBe(true);
      expect(result.missingKeys).toHaveLength(0);
      expect(result.summary.totalKeysUsed).toBe(2);
    });

    it('should detect missing keys in specific locales', () => {
      const usedKeys = [
        { key: 'actions.save', file: 'test.tsx', line: 1 },
        { key: 'actions.delete', file: 'test.tsx', line: 2 },
      ];

      const translations = {
        th: { actions: { save: 'บันทึก', delete: 'ลบ' } },
        en: { actions: { save: 'Save' } }, // Missing 'delete'
      };

      const result = validateTranslations(usedKeys, translations, ['th', 'en']);

      expect(result.success).toBe(false);
      expect(result.missingKeys).toHaveLength(1);
      expect(result.missingKeys[0]).toMatchObject({
        key: 'actions.delete',
        locale: 'en',
        severity: 'error',
      });
    });

    it('should detect keys missing in all locales', () => {
      const usedKeys = [{ key: 'actions.unknown', file: 'test.tsx', line: 1 }];

      const translations = {
        th: { actions: { save: 'บันทึก' } },
        en: { actions: { save: 'Save' } },
      };

      const result = validateTranslations(usedKeys, translations, ['th', 'en']);

      expect(result.success).toBe(false);
      expect(result.missingKeys).toHaveLength(2); // Missing in both locales
      expect(result.missingKeys.map((k) => k.locale)).toContain('th');
      expect(result.missingKeys.map((k) => k.locale)).toContain('en');
    });

    it('should detect inconsistent keys across locales', () => {
      const usedKeys: Array<{ key: string; file: string; line: number }> = [];

      const translations = {
        th: { actions: { save: 'บันทึก', thaiOnly: 'เฉพาะไทย' } },
        en: { actions: { save: 'Save' } }, // Missing 'thaiOnly'
      };

      const result = validateTranslations(usedKeys, translations, ['th', 'en']);

      expect(result.inconsistentKeys).toHaveLength(1);
      expect(result.inconsistentKeys[0]).toMatchObject({
        key: 'actions.thaiOnly',
        locale: 'en',
        severity: 'warning',
      });
    });

    it('should calculate correct coverage percentages', () => {
      const usedKeys = [
        { key: 'a', file: 'test.tsx', line: 1 },
        { key: 'b', file: 'test.tsx', line: 2 },
        { key: 'c', file: 'test.tsx', line: 3 },
        { key: 'd', file: 'test.tsx', line: 4 },
      ];

      const translations = {
        th: { a: '1', b: '2', c: '3', d: '4' }, // 4/4 = 100%
        en: { a: '1', b: '2' }, // 2/4 = 50%
      };

      const result = validateTranslations(usedKeys, translations, ['th', 'en']);

      expect(result.summary.coveragePercent.th).toBe(100);
      expect(result.summary.coveragePercent.en).toBe(50);
    });

    it('should deduplicate used keys', () => {
      const usedKeys = [
        { key: 'actions.save', file: 'file1.tsx', line: 1 },
        { key: 'actions.save', file: 'file2.tsx', line: 5 },
        { key: 'actions.save', file: 'file3.tsx', line: 10 },
      ];

      const translations = {
        th: { actions: { save: 'บันทึก' } },
        en: {}, // Missing
      };

      const result = validateTranslations(usedKeys, translations, ['th', 'en']);

      expect(result.summary.totalKeysUsed).toBe(1); // Deduplicated
      expect(result.missingKeys).toHaveLength(1); // Only one missing error per key per locale
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects to dot notation', () => {
      const obj = {
        level1: {
          level2: {
            value: 'deep',
          },
          direct: 'value',
        },
        top: 'level',
      };

      const result = flattenObject(obj);

      expect(result).toEqual({
        'level1.level2.value': 'deep',
        'level1.direct': 'value',
        top: 'level',
      });
    });

    it('should handle empty objects', () => {
      expect(flattenObject({})).toEqual({});
    });

    it('should handle single-level objects', () => {
      const obj = { a: 'A', b: 'B' };
      expect(flattenObject(obj)).toEqual({ a: 'A', b: 'B' });
    });
  });
});
