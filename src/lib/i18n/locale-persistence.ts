/**
 * Locale Persistence Service
 *
 * Handles storing and retrieving the user's locale preference using
 * cookies (for server-side access) and localStorage (for redundancy).
 *
 * The cookie is the primary storage mechanism as it's accessible on both
 * client and server. localStorage serves as a fallback.
 */

import Cookies from 'js-cookie';
import {
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_EXPIRY,
  LOCALE_STORAGE_KEY,
  isValidLocale,
  type Locale,
} from './config';

/**
 * Interface for the locale storage service
 */
export interface LocaleStorageService {
  /**
   * Get the stored locale preference
   * @returns Stored locale or null if not set
   */
  getLocale: () => Locale | null;

  /**
   * Set the locale preference
   * @param locale - Locale to store
   */
  setLocale: (locale: Locale) => void;

  /**
   * Clear the stored locale preference
   */
  clearLocale: () => void;
}

/**
 * Get the stored locale from cookie or localStorage
 * @returns Stored locale or null if not set or invalid
 */
export function getStoredLocale(): Locale | null {
  // Only run on client side
  if (typeof window === 'undefined') {
    return null;
  }

  // Try cookie first (primary storage)
  const cookieValue = Cookies.get(LOCALE_COOKIE_NAME);
  if (cookieValue && isValidLocale(cookieValue)) {
    return cookieValue;
  }

  // Try localStorage as fallback
  try {
    const storageValue = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (storageValue && isValidLocale(storageValue)) {
      // Sync to cookie for consistency
      setStoredLocale(storageValue);
      return storageValue;
    }
  } catch {
    // localStorage might not be available (e.g., private browsing)
  }

  return null;
}

/**
 * Set the locale preference in both cookie and localStorage
 * @param locale - Locale to store
 */
export function setStoredLocale(locale: Locale): void {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  // Set cookie (primary storage)
  // Cookie is set with path=/ to be accessible across all pages
  // and with SameSite=Lax for security
  Cookies.set(LOCALE_COOKIE_NAME, locale, {
    expires: LOCALE_COOKIE_EXPIRY,
    path: '/',
    sameSite: 'lax',
  });

  // Set localStorage as backup
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage might not be available
  }
}

/**
 * Clear the stored locale preference
 */
export function clearStoredLocale(): void {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  // Clear cookie
  Cookies.remove(LOCALE_COOKIE_NAME, { path: '/' });

  // Clear localStorage
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // localStorage might not be available
  }
}

/**
 * Create a locale storage service instance
 * This provides an object-oriented interface for locale persistence
 */
export function createLocaleStorageService(): LocaleStorageService {
  return {
    getLocale: getStoredLocale,
    setLocale: setStoredLocale,
    clearLocale: clearStoredLocale,
  };
}

/**
 * Hook-friendly locale persistence
 * Returns current locale and setter function
 */
export function useLocalePersistence() {
  return {
    getLocale: getStoredLocale,
    setLocale: setStoredLocale,
    clearLocale: clearStoredLocale,
  };
}

// Default export as singleton service
export const localeStorage: LocaleStorageService = {
  getLocale: getStoredLocale,
  setLocale: setStoredLocale,
  clearLocale: clearStoredLocale,
};
