/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportLanguageProvider, useReportLanguage } from '@/contexts/report-language-context';

function TestComponent() {
  const { language, setLanguage, t, formatCurrency, getAccountName } = useReportLanguage();
  return (
    <div>
      <span data-testid="current-lang">{language}</span>
      <button data-testid="toggle-btn" onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}>Toggle</button>
      <span data-testid="translated">{t('trialBalance')}</span>
      <span data-testid="currency">{formatCurrency(1000)}</span>
      <span data-testid="account-name">{getAccountName('เงินสด', 'Cash')}</span>
    </div>
  );
}

function TestUnknownKey() {
  const { t } = useReportLanguage();
  return <span data-testid="unknown-key">{t('unknownKey')}</span>;
}

describe('ReportLanguageContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage using global window object
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('defaults to English', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
    expect(screen.getByTestId('translated')).toHaveTextContent('Trial Balance');
  });

  it('toggles to Thai', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('current-lang')).toHaveTextContent('th');
    expect(screen.getByTestId('translated')).toHaveTextContent('งบทดลอง');
  });

  it('formats currency as Thai Baht', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    // Currency should always be in THB format with commas
    expect(screen.getByTestId('currency').textContent).toContain('1,000');
  });

  it('gets account name based on language', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    // Default is English
    expect(screen.getByTestId('account-name')).toHaveTextContent('Cash');

    // Toggle to Thai
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('account-name')).toHaveTextContent('เงินสด');
  });

  it('saves language preference to localStorage', () => {
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(window.localStorage.getItem('reportLanguage')).toBe('th');
  });

  it('loads language preference from localStorage', async () => {
    window.localStorage.setItem('reportLanguage', 'th');
    render(
      <ReportLanguageProvider>
        <TestComponent />
      </ReportLanguageProvider>
    );
    // Wait for useEffect to run
    await waitFor(() => {
      expect(screen.getByTestId('current-lang')).toHaveTextContent('th');
    });
  });

  it('returns key when translation not found', () => {
    render(
      <ReportLanguageProvider>
        <TestUnknownKey />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('unknown-key')).toHaveTextContent('unknownKey');
  });
});

describe('useReportLanguage hook', () => {
  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useReportLanguage must be used within a ReportLanguageProvider');

    consoleSpy.mockRestore();
  });
});
