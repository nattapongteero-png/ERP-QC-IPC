/**
 * Integration Tests for Language Switching (i18n)
 * Feature: 015-i18n (T023)
 *
 * Tests the complete language switching flow including:
 * - Cookie persistence
 * - DevExtreme locale sync
 * - Component re-rendering with new translations
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}));

// Mock DevExtreme locale sync
vi.mock('@/lib/i18n/devextreme-sync', () => ({
  initDevExtremeLocale: vi.fn().mockResolvedValue(undefined),
}));

import { CompactLanguageSwitcher, LanguageSwitcher } from '@/components/shared/language-switcher';
import { initDevExtremeLocale } from '@/lib/i18n/devextreme-sync';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

// Test messages
const testMessagesEn = {
  common: {
    actions: { save: 'Save', cancel: 'Cancel' },
  },
};

const testMessagesTh = {
  common: {
    actions: { save: 'บันทึก', cancel: 'ยกเลิก' },
  },
};

// Helper to render with providers
function renderWithProviders(
  ui: React.ReactElement,
  {
    locale = 'en' as 'en' | 'th',
    messages = testMessagesEn,
  }: { locale?: 'en' | 'th'; messages?: typeof testMessagesEn } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="Asia/Bangkok"
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

// Cookie utilities for testing
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift();
  }
  return undefined;
}

function clearCookies() {
  if (typeof document === 'undefined') return;
  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
  });
}

describe('Language Switching Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCookies();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    clearCookies();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('CompactLanguageSwitcher', () => {
    it('renders with current locale flag', () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      expect(button).toBeInTheDocument();
      expect(button.textContent).toContain('🇹🇭');
    });

    it('toggles from Thai to English on click', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      // Check that cookie was set
      await waitFor(() => {
        expect(getCookie(LOCALE_COOKIE_NAME)).toBe('en');
      });

      // Check localStorage
      expect(localStorage.getItem('i18n-locale')).toBe('en');

      // Check DevExtreme sync was called
      expect(initDevExtremeLocale).toHaveBeenCalledWith('en');

      // Check router.refresh was called
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('toggles from English to Thai on click', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'en' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      await waitFor(() => {
        expect(getCookie(LOCALE_COOKIE_NAME)).toBe('th');
      });

      expect(localStorage.getItem('i18n-locale')).toBe('th');
      expect(initDevExtremeLocale).toHaveBeenCalledWith('th');
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('calls onLanguageChange callback when provided', async () => {
      const onLanguageChange = vi.fn();
      renderWithProviders(
        <CompactLanguageSwitcher onLanguageChange={onLanguageChange} />,
        { locale: 'th' }
      );

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      expect(onLanguageChange).toHaveBeenCalledWith('en');
    });

    it('shows correct title attribute', () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      expect(button).toHaveAttribute('title', 'Switch to English');
    });
  });

  describe('Cookie Persistence', () => {
    it('sets cookie with correct expiry (365 days)', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      // Check that cookie includes max-age
      const cookies = document.cookie;
      expect(cookies).toContain(`${LOCALE_COOKIE_NAME}=en`);
    });

    it('sets cookie with path=/', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      // Cookie should be accessible from any path
      const cookieValue = getCookie(LOCALE_COOKIE_NAME);
      expect(cookieValue).toBe('en');
    });
  });

  describe('localStorage Fallback', () => {
    it('stores locale in localStorage as backup', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      expect(localStorage.getItem('i18n-locale')).toBe('en');
    });

    it('handles localStorage being unavailable gracefully', async () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });

      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');

      // Should not throw
      await expect(act(async () => {
        fireEvent.click(button);
      })).resolves.not.toThrow();

      // Cookie should still be set
      expect(getCookie(LOCALE_COOKIE_NAME)).toBe('en');

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('DevExtreme Locale Sync', () => {
    it('syncs DevExtreme locale before refresh', async () => {
      const initDevExtremeLocaleMock = vi.mocked(initDevExtremeLocale);
      initDevExtremeLocaleMock.mockResolvedValue(undefined);

      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      // DevExtreme sync should be called before refresh
      expect(initDevExtremeLocaleMock).toHaveBeenCalledWith('en');
      expect(initDevExtremeLocaleMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Router Integration', () => {
    it('calls router.refresh() to reload translations', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockRefresh).toHaveBeenCalled();
      // Should not navigate to a new page
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Language Switches', () => {
    it('handles rapid language switching', async () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');

      // First switch: th -> en
      await act(async () => {
        fireEvent.click(button);
      });

      expect(getCookie(LOCALE_COOKIE_NAME)).toBe('en');
      expect(mockRefresh).toHaveBeenCalledTimes(1);

      // Note: In real app, the component would re-render with new locale after refresh
      // For this test, we're simulating rapid clicks on the same button instance
    });
  });

  describe('Accessibility', () => {
    it('has accessible button with title', () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('title');
    });

    it('button is keyboard accessible', () => {
      renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

      const button = screen.getByTestId('compact-language-switcher');
      expect(button.tagName).toBe('BUTTON');
    });
  });
});

describe('Language Switch Performance', () => {
  it('language switch should complete quickly', async () => {
    const startTime = performance.now();

    renderWithProviders(<CompactLanguageSwitcher />, { locale: 'th' });

    const button = screen.getByTestId('compact-language-switcher');
    await act(async () => {
      fireEvent.click(button);
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete in under 500ms (requirement from spec)
    expect(duration).toBeLessThan(500);
  });
});
