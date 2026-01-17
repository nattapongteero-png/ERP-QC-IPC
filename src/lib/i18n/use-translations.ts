/**
 * Custom Translation Hook Wrappers
 *
 * Provides convenience hooks for accessing translations with common patterns
 * and development-mode warnings for missing keys.
 */

'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { Locale } from './config';

/**
 * Hook for accessing translations from a specific namespace
 * with access to common namespace as well
 */
export function useModuleTranslations(namespace: string) {
  const t = useTranslations(namespace);
  const common = useTranslations('common');
  const locale = useLocale() as Locale;

  return {
    t,
    common,
    locale,
  };
}

/**
 * Hook for accessing common translations
 */
export function useCommonTranslations() {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;

  return {
    t,
    locale,
  };
}

/**
 * Hook for accessing navigation translations
 */
export function useNavigationTranslations() {
  const t = useTranslations('navigation');
  const locale = useLocale() as Locale;

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
 * Re-export next-intl hooks for convenience
 */
export { useTranslations, useLocale };
