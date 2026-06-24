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
  type Locale,
} from '@/lib/i18n/config';

// Short uppercase locale code shown as a text badge instead of a flag emoji.
// Flag emoji (🇹🇭/🇬🇧) don't render on Chrome/Edge on Windows (no flag-emoji
// font), so they appeared as "TH"/"GB" there while Firefox showed real flags —
// making the language switcher look different per browser. Text badges render
// identically everywhere.
const localeBadges: Record<Locale, string> = { th: 'TH', en: 'EN' };
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
        flag: localeBadges[locale],
        displayName: showFlag
          ? `${localeBadges[locale]} ${localeNames[locale]}`
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
      className={`flex items-center justify-center px-3 py-2 hover:bg-gray-100 rounded transition-colors ${className || ''}`}
      title={`Switch to ${currentLocale === 'th' ? 'English' : 'ไทย'}`}
      data-testid="compact-language-switcher"
    >
      <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded bg-slate-200 text-xs font-bold leading-none text-slate-700">
        {localeBadges[currentLocale]}
      </span>
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

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;

  // Switch directly to a chosen locale (no-op if already active).
  const selectLocale = useCallback(
    async (loc: Locale) => {
      if (loc === currentLocale) return;
      setStoredLocale(loc);
      await initDevExtremeLocale(loc);
      if (onLanguageChange) onLanguageChange(loc);
      router.refresh();
    },
    [currentLocale, onLanguageChange, router],
  );

  // Slider switch: TH on the left, EN on the right, a white knob slides to the
  // active side. Pure text (TH/EN) + CSS only — renders identically across
  // Chrome / Firefox / Safari / Edge (no flag emoji, which break on Windows).
  const isEn = currentLocale === 'en';

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void selectLocale(isEn ? 'th' : 'en')}
        role="switch"
        aria-checked={isEn}
        aria-label="Toggle language"
        data-testid="sidebar-language-toggle"
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors ${className || ''}`}
      >
        <span
          className={`text-[13px] font-bold w-8 text-center transition-colors ${
            !isEn ? 'text-white' : 'text-slate-500'
          }`}
          data-testid="sidebar-language-th"
        >
          {localeBadges.th}
        </span>
        {/* Track + sliding knob */}
        <span className="relative inline-block w-[54px] h-[26px] rounded-full bg-emerald-500 flex-shrink-0">
          <span
            className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
              isEn ? 'left-[31px]' : 'left-[3px]'
            }`}
          />
        </span>
        <span
          className={`text-[13px] font-bold w-8 text-center transition-colors ${
            isEn ? 'text-white' : 'text-slate-500'
          }`}
          data-testid="sidebar-language-en"
        >
          {localeBadges.en}
        </span>
      </button>
      {appVersion && (
        <p
          className="text-center text-[10px] font-medium text-slate-400/80 tracking-wide"
          data-testid="sidebar-app-version"
        >
          v{appVersion}{buildDate ? ` · ${buildDate}` : ''}
        </p>
      )}
    </div>
  );
}
