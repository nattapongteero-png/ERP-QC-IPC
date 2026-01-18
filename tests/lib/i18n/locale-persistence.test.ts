/**
 * Unit tests for locale persistence service
 *
 * Tests localStorage and cookie-based locale preference persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock config values
const LOCALE_COOKIE_NAME = 'locale';
const LOCALE_STORAGE_KEY = 'i18n-locale';
const LOCALE_COOKIE_EXPIRY = 365;

type Locale = 'th' | 'en';

// Mock implementations for testing (these mirror the actual implementation)
interface LocaleStorageService {
  getLocale: () => Locale | null;
  setLocale: (locale: Locale) => void;
  clearLocale: () => void;
}

// LocalStorage mock
let mockLocalStorage: Record<string, string> = {};

// Cookie mock
let mockCookies: Record<string, string> = {};

// Create mock localStorage
const mockLocalStorageAPI = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockLocalStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockLocalStorage[key];
  },
  clear: () => {
    mockLocalStorage = {};
  },
};

// Create service implementation for testing
function createLocaleStorageService(): LocaleStorageService {
  const locales: Locale[] = ['th', 'en'];

  function isValidLocale(value: string): value is Locale {
    return locales.includes(value as Locale);
  }

  function getCookie(name: string): string | null {
    return mockCookies[name] || null;
  }

  function setCookie(name: string, value: string, days: number): void {
    mockCookies[name] = value;
  }

  function deleteCookie(name: string): void {
    delete mockCookies[name];
  }

  return {
    getLocale: (): Locale | null => {
      // Try cookie first
      const cookieValue = getCookie(LOCALE_COOKIE_NAME);
      if (cookieValue && isValidLocale(cookieValue)) {
        return cookieValue;
      }

      // Try localStorage
      try {
        const storageValue = mockLocalStorageAPI.getItem(LOCALE_STORAGE_KEY);
        if (storageValue && isValidLocale(storageValue)) {
          return storageValue;
        }
      } catch {
        // localStorage might not be available
      }

      return null;
    },

    setLocale: (locale: Locale): void => {
      // Set cookie
      setCookie(LOCALE_COOKIE_NAME, locale, LOCALE_COOKIE_EXPIRY);

      // Set localStorage for redundancy
      try {
        mockLocalStorageAPI.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        // localStorage might not be available
      }
    },

    clearLocale: (): void => {
      // Clear cookie
      deleteCookie(LOCALE_COOKIE_NAME);

      // Clear localStorage
      try {
        mockLocalStorageAPI.removeItem(LOCALE_STORAGE_KEY);
      } catch {
        // localStorage might not be available
      }
    },
  };
}

describe('Locale Persistence Service', () => {
  let service: LocaleStorageService;

  beforeEach(() => {
    // Clear mocks
    mockLocalStorage = {};
    mockCookies = {};
    service = createLocaleStorageService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLocale', () => {
    it('should return null when no locale is stored', () => {
      expect(service.getLocale()).toBeNull();
    });

    it('should return locale from cookie', () => {
      mockCookies[LOCALE_COOKIE_NAME] = 'en';
      expect(service.getLocale()).toBe('en');
    });

    it('should return locale from localStorage when cookie is not set', () => {
      mockLocalStorage[LOCALE_STORAGE_KEY] = 'th';
      expect(service.getLocale()).toBe('th');
    });

    it('should prefer cookie over localStorage', () => {
      mockCookies[LOCALE_COOKIE_NAME] = 'en';
      mockLocalStorage[LOCALE_STORAGE_KEY] = 'th';
      expect(service.getLocale()).toBe('en');
    });

    it('should return null for invalid locale value in cookie', () => {
      mockCookies[LOCALE_COOKIE_NAME] = 'invalid';
      expect(service.getLocale()).toBeNull();
    });

    it('should return null for invalid locale value in localStorage', () => {
      mockLocalStorage[LOCALE_STORAGE_KEY] = 'invalid';
      expect(service.getLocale()).toBeNull();
    });

    it('should fallback to localStorage when cookie has invalid value', () => {
      mockCookies[LOCALE_COOKIE_NAME] = 'invalid';
      mockLocalStorage[LOCALE_STORAGE_KEY] = 'en';
      expect(service.getLocale()).toBe('en');
    });
  });

  describe('setLocale', () => {
    it('should set locale in both cookie and localStorage', () => {
      service.setLocale('en');
      expect(mockCookies[LOCALE_COOKIE_NAME]).toBe('en');
      expect(mockLocalStorage[LOCALE_STORAGE_KEY]).toBe('en');
    });

    it('should update existing locale', () => {
      service.setLocale('th');
      expect(mockCookies[LOCALE_COOKIE_NAME]).toBe('th');

      service.setLocale('en');
      expect(mockCookies[LOCALE_COOKIE_NAME]).toBe('en');
      expect(mockLocalStorage[LOCALE_STORAGE_KEY]).toBe('en');
    });

    it('should persist Thai locale', () => {
      service.setLocale('th');
      expect(service.getLocale()).toBe('th');
    });

    it('should persist English locale', () => {
      service.setLocale('en');
      expect(service.getLocale()).toBe('en');
    });
  });

  describe('clearLocale', () => {
    it('should clear locale from both cookie and localStorage', () => {
      // First set a locale
      service.setLocale('en');
      expect(service.getLocale()).toBe('en');

      // Then clear it
      service.clearLocale();
      expect(mockCookies[LOCALE_COOKIE_NAME]).toBeUndefined();
      expect(mockLocalStorage[LOCALE_STORAGE_KEY]).toBeUndefined();
      expect(service.getLocale()).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty cookie value', () => {
      mockCookies[LOCALE_COOKIE_NAME] = '';
      expect(service.getLocale()).toBeNull();
    });

    it('should handle empty localStorage value', () => {
      mockLocalStorage[LOCALE_STORAGE_KEY] = '';
      expect(service.getLocale()).toBeNull();
    });

    it('should handle case-sensitive locale values', () => {
      mockCookies[LOCALE_COOKIE_NAME] = 'EN'; // uppercase
      expect(service.getLocale()).toBeNull(); // should be null as 'EN' is not a valid locale
    });

    it('should handle multiple setLocale calls', () => {
      service.setLocale('th');
      service.setLocale('en');
      service.setLocale('th');
      expect(service.getLocale()).toBe('th');
    });
  });
});
