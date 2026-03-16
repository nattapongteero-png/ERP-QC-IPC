import { beforeAll, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';

// Set test environment
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';

// ============================================
// Global next-intl mock for all tests
// Loads real English translations as fallback for components that use
// useTranslations() without a NextIntlClientProvider wrapper.
// Tests that set up their own NextIntlClientProvider will override
// via their own vi.mock() — vitest allows per-test mock overrides.
// ============================================
const loadAllMessages = (): Record<string, unknown> => {
  const fs = require('fs');
  const path = require('path');
  const localeDir = path.resolve(__dirname, '../src/locales/en');
  const messages: Record<string, unknown> = {};
  try {
    const files = fs.readdirSync(localeDir).filter((f: string) => f.endsWith('.json'));
    for (const file of files) {
      const namespace = file.replace('.json', '');
      messages[namespace] = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf-8'));
    }
  } catch {
    // If locale files can't be read, fall back to empty messages
  }
  return messages;
};

const allMessages = loadAllMessages();

// Resolve a nested key from messages object (e.g., "kpis.totalItems.label")
const resolveKey = (obj: unknown, keyPath: string): unknown => {
  const parts = keyPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
};

// Make useTranslations available globally without requiring NextIntlClientProvider.
// Tests that need the real provider (e.g., Thai locale tests) can override with their own vi.mock.
vi.mock('next-intl', async (importOriginal) => {
  const actual: any = await importOriginal();

  const createT = (namespace?: string) => {
    // Support dot-notation namespaces like 'dashboard.audit'
    const nsMessages = namespace ? (resolveKey(allMessages, namespace) ?? allMessages[namespace]) : allMessages;

    const t: any = (key: string, values?: Record<string, unknown>) => {
      const resolved = resolveKey(nsMessages, key);
      if (typeof resolved === 'string') {
        if (values) {
          let result = resolved;
          for (const [k, v] of Object.entries(values)) {
            result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
          return result;
        }
        return resolved;
      }
      return namespace ? `${namespace}.${key}` : key;
    };
    t.rich = t;
    t.raw = (key: string) => {
      const resolved = resolveKey(nsMessages, key);
      return resolved !== undefined ? resolved : key;
    };
    t.has = (key: string) => resolveKey(nsMessages, key) !== undefined;
    return t;
  };

  return {
    ...actual,
    useTranslations: (namespace?: string) => createT(namespace),
    useLocale: () => 'en',
    useMessages: () => allMessages,
    useNow: () => new Date(),
    useTimeZone: () => 'Asia/Bangkok',
    useFormatter: () => ({
      number: (v: number) => String(v),
      dateTime: (v: Date) => v.toISOString(),
      relativeTime: () => '',
      list: (v: string[]) => v.join(', '),
    }),
    // Keep the real NextIntlClientProvider so tests that use it work correctly
    NextIntlClientProvider: actual.NextIntlClientProvider,
  };
});

// Create a robust mock CSSStyleDeclaration
const createMockCSSStyleDeclaration = (): CSSStyleDeclaration => {
  const mockStyle = {
    getPropertyValue: () => '',
    setProperty: () => {},
    removeProperty: () => '',
    item: () => '',
    length: 0,
    parentRule: null,
    cssText: '',
    cssFloat: '',
    fontFamily: '',
    fontSize: '',
    color: '',
    backgroundColor: '',
    display: '',
    position: '',
    width: '',
    height: '',
  };
  return mockStyle as unknown as CSSStyleDeclaration;
};

// Mock window.getComputedStyle for DevExtreme theme system compatibility
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;

  const safeGetComputedStyle = (element: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
    if (!element || !element.ownerDocument || !element.isConnected) {
      return createMockCSSStyleDeclaration();
    }
    try {
      return originalGetComputedStyle.call(window, element, pseudoElt);
    } catch {
      return createMockCSSStyleDeclaration();
    }
  };

  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    configurable: true,
    value: safeGetComputedStyle,
  });

}

// Suppress DevExtreme async errors that occur after test cleanup
// These are known issues with DevExtreme's theme system in jsdom environment
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason: unknown) => {
    const message = String(reason);
    if (message.includes('trial_panel') || message.includes('document is not defined')) {
      return; // Suppress DevExtreme trial panel errors
    }
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    const message = error.message || '';
    if (message.includes('getComputedStyle') || message.includes('themes.js')) {
      return; // Suppress DevExtreme theme system errors
    }
    console.error('Uncaught Exception:', error);
    throw error; // Re-throw non-DevExtreme errors
  });
}

// Global setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  vi.clearAllTimers();
});
