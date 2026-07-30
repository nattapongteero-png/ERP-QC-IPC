'use client';

/**
 * Language Switcher Component
 *
 * A dropdown component that allows users to switch between supported languages.
 * Uses DevExtreme SelectBox for consistent UI with the rest of the application.
 * Persists language preference using cookies and localStorage.
 */

import { Fragment, useCallback, useMemo } from 'react';
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
      // min-h/min-w 44px: this is the ONLY language switcher on mobile (the
      // sidebar one is behind the ☰ menu), and it measured 52x32 — under the
      // 44px minimum tap target, so it was easy to miss on a phone.
      className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-3 py-2 hover:bg-gray-100 rounded transition-colors ${className || ''}`}
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

  // Design 02 (Linear "plain text, no container"): the switcher sits below the
  // nav and is used only a few times a year, so it stays the quietest thing on
  // the sidebar — no box, no fill, no TH/EN badges. The two language NAMES ARE
  // the control, and they double as the escape hatch: a user stranded in the
  // wrong language always sees both "ไทย" and "English" and can click their way
  // out. The active one is simply brighter and a touch heavier; the version
  // rides the same row on the right (wrapping under if space runs out). Pure
  // text + CSS renders identically across browsers (no flag emoji — those break
  // on Windows).
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 ${className || ''}`}>
      <div
        role="group"
        aria-label="Language"
        data-testid="sidebar-language-toggle"
        className="flex items-center gap-2.5"
      >
        {locales.map((loc, i) => {
          const active = loc === currentLocale;
          return (
            <Fragment key={loc}>
              {i > 0 && <span aria-hidden="true" className="h-3 w-px bg-white/10" />}
              <button
                type="button"
                onClick={() => void selectLocale(loc)}
                aria-pressed={active}
                data-testid={`sidebar-language-${loc}`}
                // min-h 44px keeps the tap target within reach on mobile even
                // though the text itself is small and quiet.
                className={`flex min-h-[44px] items-center px-1 text-sm transition-colors ${
                  active
                    ? 'font-medium text-slate-50'
                    : 'font-normal text-slate-500 hover:text-slate-300'
                }`}
              >
                {localeNames[loc]}
              </button>
            </Fragment>
          );
        })}
      </div>
      {appVersion && (
        <p
          className="shrink-0 text-[10px] font-medium tabular-nums tracking-wide text-slate-400/80"
          data-testid="sidebar-app-version"
        >
          v{appVersion}{buildDate ? ` · ${buildDate}` : ''}
        </p>
      )}
    </div>
  );
}
