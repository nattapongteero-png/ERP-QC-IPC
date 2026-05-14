/**
 * i18n Provider Contract
 *
 * This file defines the contracts (interfaces) for the i18n system components.
 * Implementation must conform to these contracts.
 */

// ============================================================================
// Locale Configuration Contract
// ============================================================================

export type Locale = 'th' | 'en';

export interface LocaleConfig {
  /** All supported locales */
  locales: readonly Locale[];

  /** Default locale (Thai) */
  defaultLocale: Locale;

  /** Fallback locale when translation is missing */
  fallbackLocale: Locale;

  /** Human-readable locale names */
  localeNames: Record<Locale, string>;

  /** All translation namespaces */
  namespaces: readonly string[];
}

// ============================================================================
// Translation Provider Contract
// ============================================================================

export interface TranslationProviderProps {
  /** Current locale */
  locale: Locale;

  /** Merged messages for all namespaces */
  messages: Record<string, unknown>;

  /** Timezone for date formatting */
  timeZone?: string;

  /** Reference date for relative time formatting */
  now?: Date;

  /** React children */
  children: React.ReactNode;
}

// ============================================================================
// Translation Hook Contract
// ============================================================================

export interface UseTranslationsReturn {
  /**
   * Get translated text for a key
   * @param key - Dot-notation translation key (e.g., 'actions.save')
   * @param values - Optional interpolation values
   * @returns Translated string
   */
  t: (key: string, values?: Record<string, string | number>) => string;

  /**
   * Format a date according to locale
   * @param date - Date to format
   * @param options - Intl.DateTimeFormatOptions
   */
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;

  /**
   * Format a number according to locale
   * @param value - Number to format
   * @param options - Intl.NumberFormatOptions
   */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

export interface UseModuleTranslationsReturn extends UseTranslationsReturn {
  /** Access to common namespace translations */
  common: UseTranslationsReturn;
}

// ============================================================================
// Language Switcher Contract
// ============================================================================

export interface LanguageSwitcherProps {
  /** Current locale (controlled) */
  value?: Locale;

  /** Callback when locale changes */
  onChange?: (locale: Locale) => void;

  /** Display variant */
  variant?: 'dropdown' | 'buttons' | 'icon-only';

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Additional CSS classes */
  className?: string;

  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export interface LanguageSwitcherState {
  /** Currently selected locale */
  currentLocale: Locale;

  /** Whether the dropdown is open (for dropdown variant) */
  isOpen: boolean;

  /** Whether locale is being switched */
  isSwitching: boolean;
}

// ============================================================================
// Locale Persistence Contract
// ============================================================================

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

// ============================================================================
// DevExtreme Sync Contract
// ============================================================================

export interface DevExtremeSyncService {
  /**
   * Sync the locale to DevExtreme components
   * @param locale - Locale to sync
   */
  syncLocale: (locale: Locale) => void;

  /**
   * Load custom DevExtreme messages for a locale
   * @param locale - Target locale
   * @param messages - Custom messages to merge
   */
  loadMessages: (locale: Locale, messages: Record<string, string>) => void;
}

// ============================================================================
// Validation Contract
// ============================================================================

export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;

  /** Missing translation keys */
  missingKeys: ValidationError[];

  /** Unused translation keys */
  unusedKeys: ValidationWarning[];

  /** Keys present in some locales but not others */
  inconsistentKeys: ValidationError[];

  /** Summary statistics */
  summary: ValidationSummary;
}

export interface ValidationError {
  /** Translation key */
  key: string;

  /** Source file where key is used */
  file: string;

  /** Line number in source file */
  line: number;

  /** Locale missing the key */
  locale: string;

  /** Error severity */
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  /** Translation key */
  key: string;

  /** Locale file containing the unused key */
  locale: string;

  /** Translation file path */
  file: string;
}

export interface ValidationSummary {
  /** Total unique keys used in codebase */
  totalKeysUsed: number;

  /** Keys defined per locale */
  totalKeysDefined: Record<Locale, number>;

  /** Count of missing keys */
  missingCount: number;

  /** Count of unused keys */
  unusedCount: number;

  /** Coverage percentage per locale */
  coveragePercent: Record<Locale, number>;
}

// ============================================================================
// Event Contracts
// ============================================================================

export interface LocaleChangeEvent {
  /** Previous locale */
  previousLocale: Locale;

  /** New locale */
  newLocale: Locale;

  /** Event timestamp */
  timestamp: Date;

  /** Source of the change */
  source: 'user' | 'auto' | 'default';
}

export type LocaleChangeListener = (event: LocaleChangeEvent) => void;

// ============================================================================
// Test Helper Contracts
// ============================================================================

export interface I18nTestWrapper {
  /**
   * Wrap a component with i18n provider for testing
   * @param locale - Locale to use in tests
   * @param messages - Optional custom messages
   */
  wrapper: React.ComponentType<{ children: React.ReactNode }>;

  /**
   * Get mock translation function
   * @param namespace - Namespace to mock
   */
  mockT: (namespace: string) => UseTranslationsReturn['t'];
}
