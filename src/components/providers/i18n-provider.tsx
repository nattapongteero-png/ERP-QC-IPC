'use client';

/**
 * I18n Provider
 *
 * Client-side wrapper for next-intl that provides translation context
 * and synchronizes with DevExtreme's localization system.
 */

import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';
import { useEffect, useState, ReactNode } from 'react';
import { initDevExtremeLocale } from '@/lib/i18n/devextreme-sync';
import { type Locale, defaultLocale, isValidLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

interface I18nProviderProps {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const validLocale: Locale = isValidLocale(locale) ? locale : defaultLocale;

  useEffect(() => {
    // Initialize DevExtreme with the current locale
    initDevExtremeLocale(validLocale).then(() => {
      setIsReady(true);
    });
  }, [validLocale]);

  // Show a minimal loading state while initializing
  // This prevents hydration mismatch
  if (!isReady) {
    return (
      <NextIntlClientProvider
        locale={validLocale}
        messages={messages}
        timeZone="Asia/Bangkok"
      >
        {children}
      </NextIntlClientProvider>
    );
  }

  return (
    <NextIntlClientProvider
      locale={validLocale}
      messages={messages}
      timeZone="Asia/Bangkok"
      onError={(error) => {
        // Log missing translations in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('[i18n]', error.message);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        // Return the key path as fallback
        return namespace ? `${namespace}.${key}` : key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Hook to get and set the current locale
 */
export function useLocaleState() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // Read initial locale from cookie
    const cookies = document.cookie.split(';');
    const localeCookie = cookies.find((c) => c.trim().startsWith(`${LOCALE_COOKIE_NAME}=`));
    if (localeCookie) {
      const value = localeCookie.split('=')[1];
      if (isValidLocale(value)) {
        setLocaleState(value);
      }
    }
  }, []);

  const setLocale = async (newLocale: Locale) => {
    // Update cookie
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale};path=/;max-age=${365 * 24 * 60 * 60}`;

    // Update DevExtreme locale
    await initDevExtremeLocale(newLocale);

    // Update state
    setLocaleState(newLocale);

    // Trigger a soft refresh to reload messages
    window.location.reload();
  };

  return { locale, setLocale };
}
