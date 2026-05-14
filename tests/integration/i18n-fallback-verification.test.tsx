/**
 * Thai Fallback Verification Tests
 * Feature: 015-i18n, User Story 4
 * Task: T045
 *
 * Integration tests that verify the fallback mechanism works correctly
 * by simulating missing English translations and verifying Thai appears.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Restore real next-intl (global mock in setup.ts overrides useTranslations)
vi.unmock('next-intl');

import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';

// ============================================
// Test Scenarios
// ============================================

/**
 * Complete Thai messages (primary/fallback locale)
 * These represent what would be in src/locales/th/dashboard.json
 */
const thaiDashboardMessages = {
  title: 'แดชบอร์ด',
  description: 'ภาพรวมระบบบริหารจัดการการผลิตยาสมุนไพร',
  kpis: {
    totalItems: {
      label: 'รายการทั้งหมด',
      subtitle: 'รายการสินค้าคงคลังที่ใช้งานอยู่',
    },
    activeWorkOrders: {
      label: 'ใบสั่งผลิตที่กำลังดำเนินการ',
      subtitle: 'อยู่ระหว่างการผลิต',
    },
    // This key exists ONLY in Thai - to test fallback
    thaiOnlyKey: {
      label: 'คีย์เฉพาะภาษาไทย',
      subtitle: 'ทดสอบการ fallback',
    },
  },
  sections: {
    recentWorkOrders: {
      title: 'ใบสั่งผลิตล่าสุด',
    },
    // This section exists ONLY in Thai
    thaiOnlySection: {
      title: 'ส่วนเฉพาะภาษาไทย',
    },
  },
};

/**
 * Partial English messages (missing some keys to simulate fallback scenario)
 * These represent what would be in src/locales/en/dashboard.json with missing keys
 */
const englishDashboardPartial = {
  title: 'Dashboard',
  description: 'Overview of the Herbal Medicine Manufacturing System',
  kpis: {
    totalItems: {
      label: 'Total Items',
      subtitle: 'Active inventory items',
    },
    activeWorkOrders: {
      label: 'Active Work Orders',
      subtitle: 'Currently in production',
    },
    // thaiOnlyKey is intentionally MISSING in English
  },
  sections: {
    recentWorkOrders: {
      title: 'Recent Work Orders',
    },
    // thaiOnlySection is intentionally MISSING in English
  },
};

// ============================================
// Deep Merge Utility (same as request.ts)
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

interface TestProviderProps {
  children: ReactNode;
  locale: 'th' | 'en';
  messages: Record<string, unknown>;
}

function TestProvider({ children, locale, messages }: TestProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Bangkok"
      onError={() => {
        // Suppress in tests
      }}
      getMessageFallback={({ namespace, key }) => {
        return namespace ? `${namespace}.${key}` : key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

// ============================================
// Verification Tests
// ============================================

describe('Thai Fallback Verification (T045)', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Scenario: English locale with missing translations', () => {
    it('should return English text when English translation exists', () => {
      // Simulate what request.ts does: merge Thai fallback with English
      const messages = deepMerge(
        { dashboard: thaiDashboardMessages },
        { dashboard: englishDashboardPartial }
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProvider locale="en" messages={messages}>
          {children}
        </TestProvider>
      );

      const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

      // These keys exist in English - should return English
      expect(result.current('title')).toBe('Dashboard');
      expect(result.current('description')).toBe('Overview of the Herbal Medicine Manufacturing System');
      expect(result.current('kpis.totalItems.label')).toBe('Total Items');
      expect(result.current('sections.recentWorkOrders.title')).toBe('Recent Work Orders');
    });

    it('should fallback to Thai when English translation is MISSING', () => {
      // Simulate what request.ts does: merge Thai fallback with English
      const messages = deepMerge(
        { dashboard: thaiDashboardMessages },
        { dashboard: englishDashboardPartial }
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProvider locale="en" messages={messages}>
          {children}
        </TestProvider>
      );

      const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

      // These keys are MISSING in English - should fallback to Thai
      expect(result.current('kpis.thaiOnlyKey.label')).toBe('คีย์เฉพาะภาษาไทย');
      expect(result.current('kpis.thaiOnlyKey.subtitle')).toBe('ทดสอบการ fallback');
      expect(result.current('sections.thaiOnlySection.title')).toBe('ส่วนเฉพาะภาษาไทย');
    });

    it('should NOT show raw key when Thai fallback is available', () => {
      const messages = deepMerge(
        { dashboard: thaiDashboardMessages },
        { dashboard: englishDashboardPartial }
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProvider locale="en" messages={messages}>
          {children}
        </TestProvider>
      );

      const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

      const fallbackResult = result.current('kpis.thaiOnlyKey.label');

      // Should NOT be the raw key path
      expect(fallbackResult).not.toBe('dashboard.kpis.thaiOnlyKey.label');
      expect(fallbackResult).not.toBe('kpis.thaiOnlyKey.label');

      // Should be Thai text
      expect(fallbackResult).toBe('คีย์เฉพาะภาษาไทย');
    });
  });

  describe('Scenario: Thai locale (no fallback needed)', () => {
    it('should return Thai text for all keys', () => {
      const messages = { dashboard: thaiDashboardMessages };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProvider locale="th" messages={messages}>
          {children}
        </TestProvider>
      );

      const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

      expect(result.current('title')).toBe('แดชบอร์ด');
      expect(result.current('kpis.totalItems.label')).toBe('รายการทั้งหมด');
      expect(result.current('kpis.thaiOnlyKey.label')).toBe('คีย์เฉพาะภาษาไทย');
      expect(result.current('sections.thaiOnlySection.title')).toBe('ส่วนเฉพาะภาษาไทย');
    });
  });

  describe('Edge cases', () => {
    it('should handle deeply nested missing keys', () => {
      const thaiMessages = {
        dashboard: {
          deeply: {
            nested: {
              structure: {
                key: 'ค่าลึกมาก',
              },
            },
          },
        },
      };

      const englishMessagesPartial = {
        dashboard: {
          deeply: {
            // nested.structure.key is MISSING
          },
        },
      };

      const messages = deepMerge(thaiMessages, englishMessagesPartial);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProvider locale="en" messages={messages}>
          {children}
        </TestProvider>
      );

      const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

      expect(result.current('deeply.nested.structure.key')).toBe('ค่าลึกมาก');
    });

    it('should prefer English when both have the key', () => {
      const messages = deepMerge(
        { dashboard: { title: 'Thai Title' } },
        { dashboard: { title: 'English Title' } }
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProvider locale="en" messages={messages}>
          {children}
        </TestProvider>
      );

      const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

      // English should take precedence
      expect(result.current('title')).toBe('English Title');
    });
  });
});

describe('Production-like Fallback Scenarios', () => {
  it('simulates a real scenario where developer adds Thai key but forgets English', () => {
    // Developer adds a new feature with Thai translations
    // but forgets to add the English translations

    const thaiMessages = {
      dashboard: {
        newFeature: {
          title: 'ฟีเจอร์ใหม่',
          description: 'คำอธิบายฟีเจอร์ใหม่',
          actions: {
            start: 'เริ่มต้น',
            stop: 'หยุด',
          },
        },
        existingFeature: {
          title: 'ฟีเจอร์เดิม',
        },
      },
    };

    const englishMessages = {
      dashboard: {
        // newFeature is MISSING - developer forgot to translate
        existingFeature: {
          title: 'Existing Feature',
        },
      },
    };

    const messages = deepMerge(thaiMessages, englishMessages);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="Asia/Bangkok"
        onError={() => {}}
        getMessageFallback={({ namespace, key }) => `${namespace}.${key}`}
      >
        {children}
      </NextIntlClientProvider>
    );

    const { result } = renderHook(() => useTranslations('dashboard'), { wrapper });

    // New feature should show Thai (fallback)
    expect(result.current('newFeature.title')).toBe('ฟีเจอร์ใหม่');
    expect(result.current('newFeature.description')).toBe('คำอธิบายฟีเจอร์ใหม่');
    expect(result.current('newFeature.actions.start')).toBe('เริ่มต้น');

    // Existing feature should show English
    expect(result.current('existingFeature.title')).toBe('Existing Feature');
  });
});
