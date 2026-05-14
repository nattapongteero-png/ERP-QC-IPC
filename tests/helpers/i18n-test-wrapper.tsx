/**
 * i18n Test Utilities
 * Feature: 015-i18n
 *
 * Provides testing utilities for components that use translations.
 * Includes mock translation providers and test helpers.
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { Locale } from '@/lib/i18n/config';

// ============================================
// Mock Messages
// ============================================

/**
 * Common mock messages for testing
 * These provide sensible defaults for common translation keys
 */
export const mockCommonMessages = {
  actions: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    refresh: 'Refresh',
    submit: 'Submit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm',
    clear: 'Clear',
    reset: 'Reset',
    apply: 'Apply',
    view: 'View',
    download: 'Download',
    upload: 'Upload',
    print: 'Print',
    copy: 'Copy',
    add: 'Add',
    remove: 'Remove',
    select: 'Select',
    selectAll: 'Select All',
  },
  status: {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    draft: 'Draft',
    completed: 'Completed',
    cancelled: 'Cancelled',
    inProgress: 'In Progress',
    onHold: 'On Hold',
    archived: 'Archived',
    expired: 'Expired',
  },
  validation: {
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    invalidNumber: 'Please enter a valid number',
    invalidDate: 'Please enter a valid date',
  },
  errors: {
    generic: 'An error occurred. Please try again.',
    networkError: 'Network error. Please check your connection.',
    notFound: 'Resource not found',
    unauthorized: 'You are not authorized to perform this action',
  },
  loading: {
    processing: 'Processing...',
    loading: 'Loading...',
    saving: 'Saving...',
    deleting: 'Deleting...',
  },
  empty: {
    noData: 'No data available',
    noResults: 'No results found',
    noRecords: 'No records to display',
    noItems: 'No items',
  },
};

export const mockNavigationMessages = {
  modules: {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    production: 'Production',
    quality: 'Quality',
    purchasing: 'Purchasing',
    sales: 'Sales',
    accounting: 'Accounting',
    hr: 'HR',
  },
  header: {
    appName: 'Herbal Medicine ERP',
    logout: 'Logout',
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
  },
};

/**
 * Default mock messages combining common and navigation
 */
export const defaultMockMessages = {
  common: mockCommonMessages,
  navigation: mockNavigationMessages,
};

// ============================================
// Test Wrappers
// ============================================

interface I18nTestProviderProps {
  children: ReactNode;
  locale?: Locale;
  messages?: Record<string, unknown>;
}

/**
 * Test provider wrapper that includes NextIntlClientProvider
 */
export function I18nTestProvider({
  children,
  locale = 'en',
  messages = defaultMockMessages,
}: I18nTestProviderProps): ReactElement {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Bangkok"
      onError={() => {
        // Suppress errors in tests
      }}
      getMessageFallback={({ namespace, key }) => {
        // Return key path as fallback
        return namespace ? `${namespace}.${key}` : key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Test provider wrapper that includes both i18n and QueryClient
 */
export function I18nQueryTestProvider({
  children,
  locale = 'en',
  messages = defaultMockMessages,
  queryClient,
}: I18nTestProviderProps & { queryClient?: QueryClient }): ReactElement {
  const client =
    queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

  return (
    <QueryClientProvider client={client}>
      <I18nTestProvider locale={locale} messages={messages}>
        {children}
      </I18nTestProvider>
    </QueryClientProvider>
  );
}

// ============================================
// Render Helpers
// ============================================

interface RenderWithI18nOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
  messages?: Record<string, unknown>;
}

/**
 * Render a component with i18n provider
 */
export function renderWithI18n(
  ui: ReactElement,
  options: RenderWithI18nOptions = {}
): RenderResult {
  const { locale = 'en', messages = defaultMockMessages, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <I18nTestProvider locale={locale} messages={messages}>
        {children}
      </I18nTestProvider>
    ),
    ...renderOptions,
  });
}

interface RenderWithI18nAndQueryOptions extends RenderWithI18nOptions {
  queryClient?: QueryClient;
}

/**
 * Render a component with i18n and QueryClient providers
 */
export function renderWithI18nAndQuery(
  ui: ReactElement,
  options: RenderWithI18nAndQueryOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const {
    locale = 'en',
    messages = defaultMockMessages,
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  } = options;

  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <I18nQueryTestProvider
          locale={locale}
          messages={messages}
          queryClient={queryClient}
        >
          {children}
        </I18nQueryTestProvider>
      ),
      ...renderOptions,
    }),
    queryClient,
  };
}

// ============================================
// Mock Utilities
// ============================================

/**
 * Create mock messages for a specific namespace
 */
export function createMockMessages(
  namespace: string,
  messages: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...defaultMockMessages,
    [namespace]: messages,
  };
}

/**
 * Create a mock translation function
 * Returns the key as the translation (useful for snapshot testing)
 */
export function createMockT(namespace?: string) {
  return (key: string, values?: Record<string, unknown>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    if (values) {
      return `${fullKey}(${JSON.stringify(values)})`;
    }
    return fullKey;
  };
}

/**
 * Mock the useTranslations hook
 */
export function mockUseTranslations(mockT: ReturnType<typeof createMockT>) {
  vi.mock('next-intl', async () => {
    const actual = await vi.importActual('next-intl');
    return {
      ...actual,
      useTranslations: () => mockT,
    };
  });
}

// ============================================
// Re-exports for convenience
// ============================================

export { vi } from 'vitest';
export { screen, waitFor, fireEvent, within } from '@testing-library/react';
