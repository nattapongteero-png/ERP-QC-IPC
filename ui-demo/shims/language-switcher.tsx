import * as React from 'react';
import { setDemoLocale, useLocale } from './next-intl';

/**
 * Demo stand-ins for the language switchers in the app shell.
 *
 * The real ones are DevExtreme select boxes, and DevExtreme may not be
 * redistributed — importing them would ship the library inside this public
 * static site. These are plain buttons over the same locale the shimmed
 * next-intl reads, so a reviewer can check both languages: a label that fits
 * in Thai often overflows in English, and that is invisible in a Thai-only
 * demo.
 */
const NEXT = { th: 'en', en: 'th' } as const;

function useToggle() {
  const locale = useLocale();
  return {
    locale,
    label: locale === 'th' ? 'ไทย' : 'English',
    short: locale === 'th' ? 'TH' : 'EN',
    toggle: () => setDemoLocale(NEXT[locale]),
    title: locale === 'th' ? 'สลับเป็นภาษาอังกฤษ' : 'Switch to Thai',
  };
}

export function LanguageSwitcher() {
  const { label, toggle, title } = useToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={title}
      title={title}
      className="inline-flex items-center rounded-full bg-[#f1f3f5] px-3 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-[#e4e7ea]"
    >
      {label}
    </button>
  );
}

export function CompactLanguageSwitcher() {
  const { short, toggle, title } = useToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={title}
      title={title}
      className="inline-flex items-center rounded-full bg-[#f1f3f5] px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-[#e4e7ea]"
    >
      {short}
    </button>
  );
}

export function SidebarLanguageToggle() {
  const { label, toggle, title } = useToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={title}
      title={title}
      className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 transition hover:bg-white/20"
    >
      {label}
    </button>
  );
}
