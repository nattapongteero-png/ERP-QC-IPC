'use client';

/**
 * Language Switcher Component
 *
 * A dropdown component that allows users to switch between supported languages.
 * Uses DevExtreme SelectBox for consistent UI with the rest of the application.
 */

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import SelectBox from 'devextreme-react/select-box';
import {
  locales,
  localeNames,
  localeFlags,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_EXPIRY,
  type Locale,
} from '@/lib/i18n/config';
import { initDevExtremeLocale } from '@/lib/i18n/devextreme-sync';

interface LocaleOption {
  id: Locale;
  name: string;
  flag: string;
  displayName: string;
}

interface LanguageSwitcherProps {
  /** Additional CSS class name */
  className?: string;
  /** Width of the select box */
  width?: number | string;
  /** Whether to show the flag emoji */
  showFlag?: boolean;
  /** Callback when language changes */
  onLanguageChange?: (locale: Locale) => void;
}

export function LanguageSwitcher({
  className,
  width = 120,
  showFlag = true,
  onLanguageChange,
}: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();

  // Create locale options
  const localeOptions: LocaleOption[] = useMemo(
    () =>
      locales.map((locale) => ({
        id: locale,
        name: localeNames[locale],
        flag: localeFlags[locale],
        displayName: showFlag
          ? `${localeFlags[locale]} ${localeNames[locale]}`
          : localeNames[locale],
      })),
    [showFlag]
  );

  // Handle language change
  const handleValueChanged = useCallback(
    async (e: { value?: Locale | null }) => {
      const newLocale = e.value;

      if (!newLocale || newLocale === currentLocale) {
        return;
      }

      // Update cookie
      document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale};path=/;max-age=${LOCALE_COOKIE_EXPIRY * 24 * 60 * 60}`;

      // Also store in localStorage for redundancy
      try {
        localStorage.setItem('i18n-locale', newLocale);
      } catch {
        // localStorage might not be available
      }

      // Sync DevExtreme locale
      await initDevExtremeLocale(newLocale);

      // Call callback if provided
      if (onLanguageChange) {
        onLanguageChange(newLocale);
      }

      // Refresh to reload messages
      router.refresh();
    },
    [currentLocale, onLanguageChange, router]
  );

  return (
    <SelectBox
      dataSource={localeOptions}
      value={currentLocale}
      valueExpr="id"
      displayExpr="displayName"
      onValueChanged={handleValueChanged}
      width={width}
      className={className}
      stylingMode="outlined"
      dropDownOptions={{
        width: 150,
      }}
      data-testid="language-switcher"
    />
  );
}

/**
 * Compact language switcher for use in headers
 * Shows only the flag by default
 */
export function CompactLanguageSwitcher({
  className,
  onLanguageChange,
}: Pick<LanguageSwitcherProps, 'className' | 'onLanguageChange'>) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();

  // Handle language toggle (only 2 languages, so we can toggle)
  const handleToggle = useCallback(async () => {
    const newLocale: Locale = currentLocale === 'th' ? 'en' : 'th';

    // Update cookie
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale};path=/;max-age=${LOCALE_COOKIE_EXPIRY * 24 * 60 * 60}`;

    // Also store in localStorage for redundancy
    try {
      localStorage.setItem('i18n-locale', newLocale);
    } catch {
      // localStorage might not be available
    }

    // Sync DevExtreme locale
    await initDevExtremeLocale(newLocale);

    // Call callback if provided
    if (onLanguageChange) {
      onLanguageChange(newLocale);
    }

    // Refresh to reload messages
    router.refresh();
  }, [currentLocale, onLanguageChange, router]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center justify-center px-3 py-2 text-lg hover:bg-gray-100 rounded transition-colors ${className || ''}`}
      title={`Switch to ${currentLocale === 'th' ? 'English' : 'ไทย'}`}
      data-testid="compact-language-switcher"
    >
      {localeFlags[currentLocale]}
    </button>
  );
}
