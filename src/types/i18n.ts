/**
 * i18n Type Definitions
 *
 * TypeScript augmentation for next-intl to provide type-safe translation keys.
 */

import type { Locale, Namespace } from '@/lib/i18n/config';

// Re-export locale types for convenience
export type { Locale, Namespace };

// Type-safe message augmentation for next-intl
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
  }
}

/**
 * Language preference stored in browser
 */
export interface LanguagePreference {
  locale: Locale;
  updatedAt: Date;
  source: 'user' | 'browser' | 'default';
}

/**
 * Event emitted when locale changes
 */
export interface LocaleChangeEvent {
  previousLocale: Locale;
  newLocale: Locale;
  timestamp: Date;
  source: 'user' | 'auto' | 'default';
}

/**
 * Locale switch listener callback
 */
export type LocaleChangeListener = (event: LocaleChangeEvent) => void;
