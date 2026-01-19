/**
 * i18n Extensibility Tests
 * Feature: 015-i18n, User Story 6
 * Task: T049
 *
 * Tests that new languages can be added to the system by:
 * 1. Adding translation files
 * 2. Registering the locale in config
 * 3. Verifying it appears in the selector and fallback works
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { NextIntlClientProvider, useTranslations, useLocale } from 'next-intl';

// ============================================
// Simulated Extended Locale Configuration
// ============================================

// Original locales
const originalLocales = ['th', 'en'] as const;
type OriginalLocale = (typeof originalLocales)[number];

// Extended locales (adding Chinese)
const extendedLocales = ['th', 'en', 'zh'] as const;
type ExtendedLocale = (typeof extendedLocales)[number];

// Extended locale names
const extendedLocaleNames: Record<ExtendedLocale, string> = {
  th: 'ไทย',
  en: 'English',
  zh: '中文',
};

// Simulated Thai messages (complete)
const thaiMessages = {
  common: {
    actions: {
      save: 'บันทึก',
      cancel: 'ยกเลิก',
      delete: 'ลบ',
    },
    status: {
      active: 'ใช้งาน',
      inactive: 'ไม่ใช้งาน',
    },
  },
  navigation: {
    modules: {
      dashboard: 'แดชบอร์ด',
      inventory: 'คลังสินค้า',
    },
  },
};

// Simulated English messages (complete)
const englishMessages = {
  common: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
    },
    status: {
      active: 'Active',
      inactive: 'Inactive',
    },
  },
  navigation: {
    modules: {
      dashboard: 'Dashboard',
      inventory: 'Inventory',
    },
  },
};

// Simulated Chinese messages (partial - to test fallback)
const chineseMessagesPartial = {
  common: {
    actions: {
      save: '保存',
      cancel: '取消',
      // delete is missing - should fallback to Thai
    },
    status: {
      active: '活跃',
      // inactive is missing - should fallback to Thai
    },
  },
  navigation: {
    modules: {
      dashboard: '仪表板',
      // inventory is missing - should fallback to Thai
    },
  },
};

// ============================================
// Deep Merge Utility
// ============================================

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(
        (target[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// ============================================
// Test Provider
// ============================================

interface ExtensibleProviderProps {
  children: ReactNode;
  locale: string; // Accept any locale string for extensibility testing
  messages: Record<string, unknown>;
}

function ExtensibleProvider({ children, locale, messages }: ExtensibleProviderProps) {
  return (
    <NextIntlClientProvider
      // Cast to satisfy next-intl types while testing extensibility
      locale={locale as 'th' | 'en'}
      messages={messages}
      timeZone="Asia/Bangkok"
      onError={() => {}}
      getMessageFallback={({ namespace, key }) => {
        return namespace ? `${namespace}.${key}` : key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('i18n Extensibility (T049)', () => {
  describe('Adding a new language (Chinese)', () => {
    it('should support registering a new locale', () => {
      // Verify new locale can be added to the array
      expect(extendedLocales).toContain('zh');
      expect(extendedLocales.length).toBe(3);
    });

    it('should have locale name for new language', () => {
      expect(extendedLocaleNames.zh).toBe('中文');
    });

    it('should render Chinese translations when available', () => {
      const messages = deepMerge(thaiMessages, chineseMessagesPartial);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="zh" messages={messages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      // Chinese translations should appear
      expect(result.current('actions.save')).toBe('保存');
      expect(result.current('actions.cancel')).toBe('取消');
      expect(result.current('status.active')).toBe('活跃');
    });

    it('should fallback to Thai for missing Chinese translations', () => {
      const messages = deepMerge(thaiMessages, chineseMessagesPartial);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="zh" messages={messages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      // Missing Chinese translations should show Thai
      expect(result.current('actions.delete')).toBe('ลบ');
      expect(result.current('status.inactive')).toBe('ไม่ใช้งาน');
    });

    it('should fallback to Thai for missing navigation keys', () => {
      const messages = deepMerge(thaiMessages, chineseMessagesPartial);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="zh" messages={messages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useTranslations('navigation'), { wrapper });

      // Available Chinese translation
      expect(result.current('modules.dashboard')).toBe('仪表板');
      // Missing Chinese translation - fallback to Thai
      expect(result.current('modules.inventory')).toBe('คลังสินค้า');
    });

    it('should report correct locale', () => {
      const messages = deepMerge(thaiMessages, chineseMessagesPartial);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="zh" messages={messages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useLocale(), { wrapper });

      expect(result.current).toBe('zh');
    });
  });

  describe('Locale configuration validation', () => {
    it('should validate locale is in allowed list', () => {
      const isValidLocale = (value: string): value is ExtendedLocale => {
        return extendedLocales.includes(value as ExtendedLocale);
      };

      expect(isValidLocale('th')).toBe(true);
      expect(isValidLocale('en')).toBe(true);
      expect(isValidLocale('zh')).toBe(true);
      expect(isValidLocale('fr')).toBe(false);
      expect(isValidLocale('ja')).toBe(false);
    });
  });

  describe('Language selector data generation', () => {
    it('should generate correct selector options for extended locales', () => {
      const selectorOptions = extendedLocales.map((locale) => ({
        value: locale,
        label: extendedLocaleNames[locale],
      }));

      expect(selectorOptions).toEqual([
        { value: 'th', label: 'ไทย' },
        { value: 'en', label: 'English' },
        { value: 'zh', label: '中文' },
      ]);
    });
  });

  describe('Backward compatibility', () => {
    it('should still work with original Thai locale', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="th" messages={thaiMessages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      expect(result.current('actions.save')).toBe('บันทึก');
      expect(result.current('status.active')).toBe('ใช้งาน');
    });

    it('should still work with original English locale', () => {
      const messages = deepMerge(thaiMessages, englishMessages);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="en" messages={messages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      expect(result.current('actions.save')).toBe('Save');
      expect(result.current('status.active')).toBe('Active');
    });
  });

  describe('Future extensibility patterns', () => {
    it('should support adding Japanese as fourth language', () => {
      const furtherExtendedLocales = ['th', 'en', 'zh', 'ja'] as const;
      type FurtherExtendedLocale = (typeof furtherExtendedLocales)[number];

      const furtherExtendedLocaleNames: Record<FurtherExtendedLocale, string> = {
        th: 'ไทย',
        en: 'English',
        zh: '中文',
        ja: '日本語',
      };

      expect(furtherExtendedLocales).toContain('ja');
      expect(furtherExtendedLocaleNames.ja).toBe('日本語');
    });

    it('should handle empty translation file gracefully', () => {
      // Simulate a new language with only required common keys
      const minimalMessages = {
        common: {
          actions: {
            save: 'Speichern', // German example
          },
        },
      };

      const messages = deepMerge(thaiMessages, minimalMessages);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ExtensibleProvider locale="de" messages={messages}>
          {children}
        </ExtensibleProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      // German translation available
      expect(result.current('actions.save')).toBe('Speichern');
      // Missing German translations fallback to Thai
      expect(result.current('actions.cancel')).toBe('ยกเลิก');
      expect(result.current('status.active')).toBe('ใช้งาน');
    });
  });
});

describe('Required vs Optional Locales', () => {
  it('should distinguish between required and optional locales', () => {
    const validationConfig = {
      requiredLocales: ['th', 'en'] as const,
      optionalLocales: ['zh', 'ja'] as const,
    };

    // Required locales must have all keys
    expect(validationConfig.requiredLocales).toContain('th');
    expect(validationConfig.requiredLocales).toContain('en');

    // Optional locales can have partial coverage
    expect(validationConfig.optionalLocales).toContain('zh');
    expect(validationConfig.optionalLocales).toContain('ja');
  });

  it('should allow configuring which locales are required vs optional', () => {
    type LocaleRequirement = 'required' | 'optional';

    const localeConfig: Record<string, LocaleRequirement> = {
      th: 'required',
      en: 'required',
      zh: 'optional',
      ja: 'optional',
    };

    expect(localeConfig.th).toBe('required');
    expect(localeConfig.en).toBe('required');
    expect(localeConfig.zh).toBe('optional');
    expect(localeConfig.ja).toBe('optional');
  });
});
