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

export default getRequestConfig(async () => {
  // Get locale from cookie
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  // Validate and use cookie value, or fall back to default
  const locale: Locale = isValidLocale(localeCookie || '')
    ? (localeCookie as Locale)
    : defaultLocale;

  // Load messages for the locale
  // We load common, navigation, and dashboard by default, other namespaces loaded on demand
  const [commonMessages, navigationMessages, dashboardMessages] = await Promise.all([
    import(`@/locales/${locale}/common.json`).then((m) => m.default).catch(() => ({})),
    import(`@/locales/${locale}/navigation.json`).then((m) => m.default).catch(() => ({})),
    import(`@/locales/${locale}/dashboard.json`).then((m) => m.default).catch(() => ({})),
  ]);

  // For fallback support, load Thai messages if locale is not Thai
  // This ensures that when an English translation is missing, Thai text appears
  let fallbackMessages: Record<string, unknown> = {};
  if (locale !== fallbackLocale) {
    const [thCommon, thNavigation, thDashboard] = await Promise.all([
      import('@/locales/th/common.json').then((m) => m.default).catch(() => ({})),
      import('@/locales/th/navigation.json').then((m) => m.default).catch(() => ({})),
      import('@/locales/th/dashboard.json').then((m) => m.default).catch(() => ({})),
    ]);
    // Combine all Thai fallback messages
    fallbackMessages = {
      common: thCommon,
      navigation: thNavigation,
      dashboard: thDashboard,
    };
  }

  // Build current locale messages with proper namespace structure
  const currentMessages: Record<string, unknown> = {
    common: commonMessages,
    navigation: navigationMessages,
    dashboard: dashboardMessages,
  };

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
