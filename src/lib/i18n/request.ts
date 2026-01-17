/**
 * next-intl Request Configuration
 *
 * Server-side configuration for next-intl that handles locale detection
 * from cookies and loads the appropriate messages.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import {
  defaultLocale,
  isValidLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
} from './config';

export default getRequestConfig(async () => {
  // Get locale from cookie
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  // Validate and use cookie value, or fall back to default
  const locale: Locale = isValidLocale(localeCookie || '')
    ? (localeCookie as Locale)
    : defaultLocale;

  // Load messages for the locale
  // We load common and navigation by default, other namespaces loaded on demand
  const [commonMessages, navigationMessages] = await Promise.all([
    import(`@/locales/${locale}/common.json`).then((m) => m.default).catch(() => ({})),
    import(`@/locales/${locale}/navigation.json`).then((m) => m.default).catch(() => ({})),
  ]);

  // For fallback support, also load Thai messages if locale is not Thai
  let fallbackMessages = {};
  if (locale !== 'th') {
    const [thCommon, thNavigation] = await Promise.all([
      import('@/locales/th/common.json').then((m) => m.default).catch(() => ({})),
      import('@/locales/th/navigation.json').then((m) => m.default).catch(() => ({})),
    ]);
    fallbackMessages = { ...thCommon, ...thNavigation };
  }

  // Merge messages with fallback (current locale takes precedence)
  const messages = {
    ...fallbackMessages,
    ...commonMessages,
    ...navigationMessages,
  };

  return {
    locale,
    messages,
    timeZone: 'Asia/Bangkok',
    now: new Date(),
    // Configure fallback behavior
    onError: (error) => {
      // Log missing translations in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[i18n]', error.message);
      }
    },
    getMessageFallback: ({ namespace, key }) => {
      // Return the key as fallback (will show Thai text due to message merge above)
      return `${namespace}.${key}`;
    },
  };
});
