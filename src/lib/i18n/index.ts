/**
 * i18n Module Index
 *
 * Central export point for all i18n utilities and configurations.
 */

// Configuration
export {
  locales,
  defaultLocale,
  fallbackLocale,
  localeNames,
  localeFlags,
  namespaces,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  LOCALE_COOKIE_EXPIRY,
  isValidLocale,
  getLocaleName,
  getLocaleWithFlag,
  type Locale,
  type Namespace,
} from './config';

// Custom hooks
export {
  useModuleTranslations,
  useCommonTranslations,
  useNavigationTranslations,
  useCurrentLocale,
  useTranslations,
  useLocale,
} from './use-translations';

// DevExtreme sync
export {
  syncDevExtremeLocale,
  loadDevExtremeMessages,
  initDevExtremeLocale,
} from './devextreme-sync';

// Locale persistence
export {
  getStoredLocale,
  setStoredLocale,
  clearStoredLocale,
  createLocaleStorageService,
  useLocalePersistence,
  localeStorage,
  type LocaleStorageService,
} from './locale-persistence';
