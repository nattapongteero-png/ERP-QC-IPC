/**
 * next-intl Request Configuration
 *
 * Server-side configuration for next-intl that handles locale detection
 * from cookies and loads the appropriate messages.
 *
 * Implements Thai fallback: when an English translation is missing,
 * the corresponding Thai text is displayed instead of showing raw keys.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import {
  defaultLocale,
  fallbackLocale,
  isValidLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
} from './config';

/**
 * Deep merge two objects (for merging translation messages)
 * Source values take precedence over target values.
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

/**
 * All namespace-to-filename mappings.
 * Key = namespace used in useTranslations(), Value = JSON filename (without .json)
 */
const NAMESPACE_FILES: Record<string, string> = {
  common: 'common',
  navigation: 'navigation',
  devextreme: 'devextreme',
  dashboard: 'dashboard',
  accounting: 'accounting',
  admin: 'admin',
  cost: 'cost',
  gmp: 'gmp',
  hr: 'hr',
  inventory: 'inventory',
  issues: 'issues',
  login: 'login',
  masterData: 'masterData',
  production: 'production',
  purchasing: 'purchasing',
  quality: 'quality',
  reports: 'reports',
  sales: 'sales',
  settings: 'settings',
  template: 'template',
  users: 'users',
  vmi: 'vmi',
};

/**
 * Load all namespace files for a given locale
 */
async function loadAllNamespaces(locale: string): Promise<Record<string, unknown>> {
  const entries = Object.entries(NAMESPACE_FILES);
  const results = await Promise.all(
    entries.map(([, fileName]) =>
      import(`@/locales/${locale}/${fileName}.json`).then((m) => m.default).catch(() => ({}))
    )
  );
  const messages: Record<string, unknown> = {};
  entries.forEach(([ns], i) => {
    messages[ns] = results[i];
  });
  return messages;
}

export default getRequestConfig(async () => {
  // Get locale from cookie
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  // Validate and use cookie value, or fall back to default
  const locale: Locale = isValidLocale(localeCookie || '')
    ? (localeCookie as Locale)
    : defaultLocale;

  // Load ALL namespace messages for the current locale
  const currentMessages = await loadAllNamespaces(locale);

  // For fallback support, load Thai messages if locale is not Thai
  // This ensures that when an English translation is missing, Thai text appears
  let fallbackMessages: Record<string, unknown> = {};
  if (locale !== fallbackLocale) {
    fallbackMessages = await loadAllNamespaces(fallbackLocale);
  }

  // Deep merge: fallback first (Thai), then current locale (takes precedence)
  // This ensures missing English keys fallback to Thai text
  const messages = deepMerge(fallbackMessages, currentMessages);

  return {
    locale,
    messages,
    timeZone: 'Asia/Bangkok',
    now: new Date(),
    // Configure fallback behavior for runtime errors
    onError: (error) => {
      // Log missing translations in development mode
      if (process.env.NODE_ENV === 'development') {
        console.warn('[i18n] Missing translation:', error.message);
      }
    },
    getMessageFallback: ({ namespace, key }) => {
      // This is the final fallback when a key is missing in ALL locales
      // Return the full key path to help developers identify missing translations
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});
