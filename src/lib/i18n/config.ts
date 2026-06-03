/**
 * i18n Configuration
 *
 * Central configuration for internationalization including supported locales,
 * default settings, and translation namespaces.
 */

/**
 * Supported locales
 */
export const locales = ['th', 'en'] as const;
export type Locale = (typeof locales)[number];

/**
 * Default locale (Thai)
 */
export const defaultLocale: Locale = 'th';

/**
 * Fallback locale when translation is missing
 */
export const fallbackLocale: Locale = 'th';

/**
 * Human-readable locale names for UI display
 */
export const localeNames: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
};

/**
 * Locale flags for visual representation
 */
export const localeFlags: Record<Locale, string> = {
  th: '🇹🇭',
  en: '🇬🇧',
};

/**
 * Translation namespaces organized by module
 */
export const namespaces = [
  'common',
  'navigation',
  'devextreme',
  'accounting',
  'admin',
  'cost',
  'dashboard',
  'gmp',
  'goodsReceipt',
  'hr',
  'inventory',
  'issues',
  'login',
  'masterData',
  'material-withdrawal',
  'packaging',
  'production',
  'purchasing',
  'quality',
  'reports',
  'sales',
  'settings',
  'template',
  'users',
  'vmi',
] as const;

export type Namespace = (typeof namespaces)[number];

/**
 * Cookie name for storing locale preference
 */
export const LOCALE_COOKIE_NAME = 'locale';

/**
 * LocalStorage key for storing locale preference
 */
export const LOCALE_STORAGE_KEY = 'i18n-locale';

/**
 * Cookie expiration in days
 */
export const LOCALE_COOKIE_EXPIRY = 365;

/**
 * Check if a string is a valid locale
 */
export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

/**
 * Get locale display name
 */
export function getLocaleName(locale: Locale): string {
  return localeNames[locale];
}

/**
 * Get locale with flag
 */
export function getLocaleWithFlag(locale: Locale): string {
  return `${localeFlags[locale]} ${localeNames[locale]}`;
}
