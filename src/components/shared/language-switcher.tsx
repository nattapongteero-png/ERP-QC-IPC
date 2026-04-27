'use client';

/**
 * Language Switcher Component
 *
 * A dropdown component that allows users to switch between supported languages.
 * Uses DevExtreme SelectBox for consistent UI with the rest of the application.
 * Persists language preference using cookies and localStorage.
 */

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import SelectBox from 'devextreme-react/select-box';
import {
  locales,
  localeNames,
  localeFlags,
  type Locale,
} from '@/lib/i18n/config';
import { initDevExtremeLocale } from '@/lib/i18n/devextreme-sync';
import { setStoredLocale } from '@/lib/i18n/locale-persistence';

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

      // Persist locale preference (cookie + localStorage)
      setStoredLocale(newLocale);

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

    // Persist locale preference (cookie + localStorage)
    setStoredLocale(newLocale);

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

/**
 * Sidebar Language Toggle — native HTML toggle button
 *
 * Replacement for DevExtreme SelectBox-based `LanguageSwitcher` in the
 * sidebar. Reason: DevExtreme's dropdown portal has positioning issues
 * on Chrome 147 (dropdown doesn't appear or gets clipped). Native
 * HTML button is reliable across all browsers and always visible since
 * there are only 2 languages — a toggle is the right UX anyway.
 */
export function SidebarLanguageToggle({
  className,
  onLanguageChange,
}: Pick<LanguageSwitcherProps, 'className' | 'onLanguageChange'>) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();

  const handleToggle = useCallback(async () => {
    const newLocale: Locale = currentLocale === 'th' ? 'en' : 'th';
    setStoredLocale(newLocale);
    await initDevExtremeLocale(newLocale);
    if (onLanguageChange) onLanguageChange(newLocale);
    router.refresh();
  }, [currentLocale, onLanguageChange, router]);

  const nextLocale: Locale = currentLocale === 'th' ? 'en' : 'th';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${localeNames[nextLocale]}`}
      title={`Switch to ${localeNames[nextLocale]}`}
      data-testid="sidebar-language-toggle"
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-200 bg-slate-700/40 hover:bg-slate-600/60 border border-slate-600/40 transition-colors ${className || ''}`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-base">{localeFlags[currentLocale]}</span>
        <span className="truncate">{localeNames[currentLocale]}</span>
      </span>
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 10l5 5 5-5" style={{ display: 'none' }} />
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span>{localeFlags[nextLocale]}</span>
      </span>
    </button>
  );
}
