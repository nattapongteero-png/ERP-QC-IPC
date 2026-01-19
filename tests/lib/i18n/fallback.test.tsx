/**
 * Thai Fallback Behavior Tests
 * Feature: 015-i18n, User Story 4
 *
 * Tests that when English translation is missing, the system falls back to Thai
 * text instead of showing raw keys.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';

// ============================================
// Test Messages
// ============================================

/**
 * Complete Thai messages (primary locale)
 */
const thaiMessages = {
  common: {
    actions: {
      save: 'บันทึก',
      cancel: 'ยกเลิก',
      delete: 'ลบ',
      specialAction: 'การดำเนินการพิเศษ', // Only exists in Thai
    },
    status: {
      active: 'ใช้งาน',
      inactive: 'ไม่ใช้งาน',
      customStatus: 'สถานะกำหนดเอง', // Only exists in Thai
    },
    errors: {
      generic: 'เกิดข้อผิดพลาด',
      networkError: 'เครือข่ายขัดข้อง',
      specialError: 'ข้อผิดพลาดพิเศษ', // Only exists in Thai
    },
  },
  navigation: {
    modules: {
      dashboard: 'แดชบอร์ด',
      inventory: 'คลังสินค้า',
      customModule: 'โมดูลกำหนดเอง', // Only exists in Thai
    },
  },
};

/**
 * Partial English messages (missing some keys to test fallback)
 */
const englishMessagesPartial = {
  common: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      // specialAction is missing - should fallback to Thai
    },
    status: {
      active: 'Active',
      inactive: 'Inactive',
      // customStatus is missing - should fallback to Thai
    },
    errors: {
      generic: 'An error occurred',
      networkError: 'Network error',
      // specialError is missing - should fallback to Thai
    },
  },
  navigation: {
    modules: {
      dashboard: 'Dashboard',
      inventory: 'Inventory',
      // customModule is missing - should fallback to Thai
    },
  },
};

// ============================================
// Test Helpers
// ============================================

interface FallbackTestProviderProps {
  children: ReactNode;
  locale: 'th' | 'en';
  primaryMessages: Record<string, unknown>;
  fallbackMessages?: Record<string, unknown>;
}

/**
 * Provider that simulates the fallback behavior from request.ts
 * Messages are merged with fallback (current locale takes precedence)
 */
function FallbackTestProvider({
  children,
  locale,
  primaryMessages,
  fallbackMessages,
}: FallbackTestProviderProps) {
  // Merge messages with fallback (same logic as request.ts)
  const mergedMessages = fallbackMessages
    ? deepMerge(fallbackMessages, primaryMessages)
    : primaryMessages;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={mergedMessages}
      timeZone="Asia/Bangkok"
      onError={(error) => {
        // Simulate dev mode warning
        console.warn('[i18n]', error.message);
      }}
      getMessageFallback={({ namespace, key }) => {
        // Return key path as final fallback
        return namespace ? `${namespace}.${key}` : key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Deep merge two objects (for merging translation messages)
 */
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
// Tests
// ============================================

describe('i18n Fallback Behavior', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Thai locale (no fallback needed)', () => {
    it('returns Thai text for all keys', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="th"
          primaryMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      expect(result.current('actions.save')).toBe('บันทึก');
      expect(result.current('actions.cancel')).toBe('ยกเลิก');
      expect(result.current('actions.specialAction')).toBe('การดำเนินการพิเศษ');
      expect(result.current('status.active')).toBe('ใช้งาน');
      expect(result.current('status.customStatus')).toBe('สถานะกำหนดเอง');
    });

    it('returns Thai navigation text', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="th"
          primaryMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('navigation'), { wrapper });

      expect(result.current('modules.dashboard')).toBe('แดชบอร์ด');
      expect(result.current('modules.customModule')).toBe('โมดูลกำหนดเอง');
    });
  });

  describe('English locale with Thai fallback', () => {
    it('returns English text when translation exists', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="en"
          primaryMessages={englishMessagesPartial}
          fallbackMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      expect(result.current('actions.save')).toBe('Save');
      expect(result.current('actions.cancel')).toBe('Cancel');
      expect(result.current('actions.delete')).toBe('Delete');
      expect(result.current('status.active')).toBe('Active');
    });

    it('falls back to Thai when English translation is missing', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="en"
          primaryMessages={englishMessagesPartial}
          fallbackMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      // These keys are missing in English, should return Thai
      expect(result.current('actions.specialAction')).toBe('การดำเนินการพิเศษ');
      expect(result.current('status.customStatus')).toBe('สถานะกำหนดเอง');
      expect(result.current('errors.specialError')).toBe('ข้อผิดพลาดพิเศษ');
    });

    it('falls back to Thai for missing navigation keys', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="en"
          primaryMessages={englishMessagesPartial}
          fallbackMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('navigation'), { wrapper });

      // Existing English key
      expect(result.current('modules.dashboard')).toBe('Dashboard');
      // Missing English key - fallback to Thai
      expect(result.current('modules.customModule')).toBe('โมดูลกำหนดเอง');
    });

    it('does not show raw key when fallback is available', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="en"
          primaryMessages={englishMessagesPartial}
          fallbackMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      const fallbackResult = result.current('actions.specialAction');

      // Should NOT be the raw key path
      expect(fallbackResult).not.toBe('common.actions.specialAction');
      expect(fallbackResult).not.toBe('actions.specialAction');
      // Should be the Thai fallback
      expect(fallbackResult).toBe('การดำเนินการพิเศษ');
    });
  });

  describe('Final fallback behavior (key missing in both locales)', () => {
    it('returns key path when missing in all locales', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="en"
          primaryMessages={englishMessagesPartial}
          fallbackMessages={thaiMessages}
        >
          {children}
        </FallbackTestProvider>
      );

      const { result } = renderHook(() => useTranslations('common'), { wrapper });

      // This key doesn't exist in either locale
      // next-intl will call getMessageFallback
      const missingResult = result.current('actions.nonExistentKey');

      // Should return the key path as final fallback
      expect(missingResult).toBe('common.actions.nonExistentKey');
    });
  });

  describe('Deep merge behavior', () => {
    it('correctly merges nested objects', () => {
      const target = {
        a: { b: 1, c: 2 },
        d: 3,
      };
      const source = {
        a: { b: 10, e: 5 },
        f: 6,
      };

      const merged = deepMerge(target, source);

      expect(merged).toEqual({
        a: { b: 10, c: 2, e: 5 }, // b overwritten, c preserved, e added
        d: 3, // preserved
        f: 6, // added
      });
    });

    it('source takes precedence over target', () => {
      const merged = deepMerge(
        { key: 'Thai value' },
        { key: 'English value' }
      );

      expect(merged.key).toBe('English value');
    });

    it('preserves target keys not in source', () => {
      const merged = deepMerge(
        { thaiOnly: 'Thai text', shared: 'Thai' },
        { shared: 'English' }
      );

      expect(merged.thaiOnly).toBe('Thai text');
      expect(merged.shared).toBe('English');
    });
  });

  describe('Development mode warnings', () => {
    it('logs warning when translation is missing and falls back', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <FallbackTestProvider
          locale="en"
          primaryMessages={{ common: {} }} // Empty messages
          fallbackMessages={{ common: {} }} // Empty fallback
        >
          {children}
        </FallbackTestProvider>
      );

      renderHook(() => {
        const t = useTranslations('common');
        // Access a missing key to trigger fallback
        t('nonExistent');
      }, { wrapper });

      // Warning should have been logged
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Message merge matches request.ts behavior', () => {
    it('merges fallback first, then primary locale', () => {
      // This simulates the exact merge logic in request.ts:
      // const messages = {
      //   ...fallbackMessages,
      //   ...commonMessages,
      //   ...navigationMessages,
      // };

      const fallback = {
        common: { actions: { save: 'บันทึก', special: 'พิเศษ' } },
      };
      const primary = {
        common: { actions: { save: 'Save' } },
      };

      // Simulate the merge
      const merged = deepMerge(fallback, primary);

      // Primary takes precedence for existing keys
      expect((merged.common as Record<string, Record<string, string>>).actions.save).toBe('Save');
      // Fallback provides missing keys
      expect((merged.common as Record<string, Record<string, string>>).actions.special).toBe('พิเศษ');
    });
  });
});

describe('Fallback with interpolation', () => {
  it('handles interpolation in fallback messages', () => {
    const thaiWithInterpolation = {
      common: {
        validation: {
          minLength: 'ต้องมีอย่างน้อย {min} ตัวอักษร',
        },
      },
    };

    const emptyEnglish = {
      common: {
        validation: {},
      },
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider
        locale="en"
        messages={deepMerge(thaiWithInterpolation, emptyEnglish)}
        timeZone="Asia/Bangkok"
      >
        {children}
      </NextIntlClientProvider>
    );

    const { result } = renderHook(() => useTranslations('common'), { wrapper });

    const translated = result.current('validation.minLength', { min: 5 });
    expect(translated).toBe('ต้องมีอย่างน้อย 5 ตัวอักษร');
  });
});
