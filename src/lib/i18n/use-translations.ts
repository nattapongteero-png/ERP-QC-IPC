/**
 * Custom Translation Hook Wrappers
 *
 * Provides convenience hooks for accessing translations with common patterns
 * and development-mode warnings for missing keys.
 *
 * Feature: 015-i18n
 * User Story 4: Thai fallback with developer warnings
 */

'use client';

import { useTranslations, useLocale, useMessages } from 'next-intl';
import { useCallback } from 'react';
import type { Locale } from './config';
import { fallbackLocale } from './config';

// Type for translation values
type TranslationValues = Record<string, string | number | Date> | undefined;

// Track warned keys to avoid spamming console
const warnedKeys = new Set<string>();

/**
 * Log a development warning for missing translation
 * Only logs once per key to avoid console spam
 */
function logMissingTranslation(
  namespace: string,
  key: string,
  locale: string,
  usingFallback: boolean
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const fullKey = `${namespace}.${key}`;
  if (warnedKeys.has(fullKey)) return;

  warnedKeys.add(fullKey);

  if (usingFallback) {
    console.warn(
      `[i18n] Missing "${locale}" translation for "${fullKey}", using Thai fallback`
    );
  } else {
    console.warn(
      `[i18n] Missing translation key "${fullKey}" in all locales`
    );
  }
}

/**
 * Check if a key exists in the messages object
 */
function hasKey(messages: Record<string, unknown>, keyPath: string): boolean {
  const parts = keyPath.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = messages;

  for (const part of parts) {
    if (current === undefined || current === null) return false;
    if (typeof current !== 'object') return false;
    current = current[part];
  }

  return current !== undefined && current !== null;
}

/**
 * Hook for accessing translations from a specific namespace
 * with access to common namespace as well and development-mode warnings
 */
export function useModuleTranslations(namespace: string) {
  const baseT = useTranslations(namespace);
  const common = useTranslations('common');
  const locale = useLocale() as Locale;
  const messages = useMessages();

  // Wrap translation function with dev warning support
  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const result = baseT(key, values as Parameters<typeof baseT>[1]);

      // In dev mode, check if we're using a fallback
      if (process.env.NODE_ENV === 'development' && locale !== fallbackLocale) {
        const namespaceMessages = messages[namespace] as Record<string, unknown> | undefined;

        // Check if key exists in current locale's namespace
        if (namespaceMessages && !hasKey(namespaceMessages, key)) {
          // Key is missing in current locale, check if result looks like Thai (fallback)
          const isThaiText = /[\u0E00-\u0E7F]/.test(String(result));
          if (isThaiText) {
            logMissingTranslation(namespace, key, locale, true);
          }
        }
      }

      return result;
    },
    [baseT, locale, messages, namespace]
  );

  return {
    t,
    common,
    locale,
  };
}

/**
 * Hook for accessing common translations with dev-mode warnings
 */
export function useCommonTranslations() {
  const baseT = useTranslations('common');
  const locale = useLocale() as Locale;
  const messages = useMessages();

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const result = baseT(key, values as Parameters<typeof baseT>[1]);

      if (process.env.NODE_ENV === 'development' && locale !== fallbackLocale) {
        const commonMessages = messages.common as Record<string, unknown> | undefined;

        if (commonMessages && !hasKey(commonMessages, key)) {
          const isThaiText = /[\u0E00-\u0E7F]/.test(String(result));
          if (isThaiText) {
            logMissingTranslation('common', key, locale, true);
          }
        }
      }

      return result;
    },
    [baseT, locale, messages]
  );

  return {
    t,
    locale,
  };
}

/**
 * Hook for accessing navigation translations with dev-mode warnings
 */
export function useNavigationTranslations() {
  const baseT = useTranslations('navigation');
  const locale = useLocale() as Locale;
  const messages = useMessages();

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const result = baseT(key, values as Parameters<typeof baseT>[1]);

      if (process.env.NODE_ENV === 'development' && locale !== fallbackLocale) {
        const navMessages = messages.navigation as Record<string, unknown> | undefined;

        if (navMessages && !hasKey(navMessages, key)) {
          const isThaiText = /[\u0E00-\u0E7F]/.test(String(result));
          if (isThaiText) {
            logMissingTranslation('navigation', key, locale, true);
          }
        }
      }

      return result;
    },
    [baseT, locale, messages]
  );

  return {
    t,
    locale,
  };
}

/**
 * Hook for accessing dashboard translations with dev-mode warnings
 */
export function useDashboardTranslations() {
  const baseT = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const messages = useMessages();

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const result = baseT(key, values as Parameters<typeof baseT>[1]);

      if (process.env.NODE_ENV === 'development' && locale !== fallbackLocale) {
        const dashboardMessages = messages.dashboard as Record<string, unknown> | undefined;

        if (dashboardMessages && !hasKey(dashboardMessages, key)) {
          const isThaiText = /[\u0E00-\u0E7F]/.test(String(result));
          if (isThaiText) {
            logMissingTranslation('dashboard', key, locale, true);
          }
        }
      }

      return result;
    },
    [baseT, locale, messages]
  );

  return {
    t,
    locale,
  };
}

/**
 * Hook for getting current locale
 */
export function useCurrentLocale(): Locale {
  return useLocale() as Locale;
}

/**
 * Clear the warned keys cache (useful for testing)
 */
export function clearWarnedKeysCache(): void {
  warnedKeys.clear();
}

/**
 * Re-export next-intl hooks for convenience
 */
export { useTranslations, useLocale, useMessages };
