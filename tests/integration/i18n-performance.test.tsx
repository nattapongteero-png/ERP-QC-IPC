/**
 * i18n Performance Tests
 * Feature: 015-i18n, Task: T066
 *
 * Verify language switch happens under 500ms
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Restore real next-intl (global mock in setup.ts overrides useTranslations)
vi.unmock('next-intl');

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(() => 'th'),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Test messages
const thMessages = {
  common: {
    actions: {
      save: 'บันทึก',
      cancel: 'ยกเลิก',
    },
  },
};

const enMessages = {
  common: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
    },
  },
};

// Simple test component that displays translations
function TestComponent() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTranslations } = require('next-intl');
  const t = useTranslations('common');

  return (
    <div>
      <span data-testid="save-text">{t('actions.save')}</span>
      <span data-testid="cancel-text">{t('actions.cancel')}</span>
    </div>
  );
}

function createTestWrapper(locale: 'th' | 'en', messages: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  };
}

describe('i18n Performance (T066)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Thai translations', () => {
    const Wrapper = createTestWrapper('th', thMessages);
    render(<TestComponent />, { wrapper: Wrapper });

    expect(screen.getByTestId('save-text')).toHaveTextContent('บันทึก');
    expect(screen.getByTestId('cancel-text')).toHaveTextContent('ยกเลิก');
  });

  it('should render English translations', () => {
    const Wrapper = createTestWrapper('en', enMessages);
    render(<TestComponent />, { wrapper: Wrapper });

    expect(screen.getByTestId('save-text')).toHaveTextContent('Save');
    expect(screen.getByTestId('cancel-text')).toHaveTextContent('Cancel');
  });

  it('should switch translations under 500ms', async () => {
    // Measure time for re-render with different locale
    const startTime = performance.now();

    // First render with Thai
    const ThaiWrapper = createTestWrapper('th', thMessages);
    const { unmount } = render(<TestComponent />, { wrapper: ThaiWrapper });

    // Verify Thai text
    expect(screen.getByTestId('save-text')).toHaveTextContent('บันทึก');

    // Unmount and re-render with English
    unmount();

    const EnglishWrapper = createTestWrapper('en', enMessages);
    render(<TestComponent />, { wrapper: EnglishWrapper });

    // Verify English text
    expect(screen.getByTestId('save-text')).toHaveTextContent('Save');

    const endTime = performance.now();
    const elapsedTime = endTime - startTime;

    // Assert under 500ms
    expect(elapsedTime).toBeLessThan(500);
    console.log('Language switch time: ' + elapsedTime.toFixed(2) + 'ms');
  });

  it('should handle multiple rapid locale switches under 500ms total', async () => {
    const startTime = performance.now();

    // Simulate 10 rapid switches
    for (let i = 0; i < 10; i++) {
      const locale = (i % 2 === 0 ? 'th' : 'en') as 'th' | 'en';
      const messages = i % 2 === 0 ? thMessages : enMessages;
      const Wrapper = createTestWrapper(locale, messages);

      const { unmount } = render(<TestComponent />, { wrapper: Wrapper });

      // Verify correct text
      const expectedText = i % 2 === 0 ? 'บันทึก' : 'Save';
      expect(screen.getByTestId('save-text')).toHaveTextContent(expectedText);

      unmount();
    }

    const endTime = performance.now();
    const elapsedTime = endTime - startTime;

    // 10 switches should still be under 500ms (50ms per switch average)
    expect(elapsedTime).toBeLessThan(500);
    console.log('10 language switches time: ' + elapsedTime.toFixed(2) + 'ms (avg: ' + (elapsedTime / 10).toFixed(2) + 'ms per switch)');
  });
});
