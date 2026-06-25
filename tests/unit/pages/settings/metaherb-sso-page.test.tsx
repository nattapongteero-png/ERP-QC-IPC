/**
 * Metaherb SSO Settings Page tests
 *
 * Verifies the admin config page renders without crashing, loads existing
 * config via the API, masks the secret (never shows a value), and PUTs the
 * callback URL + new secret on save.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import MetaherbSsoSettingsPage from '@/app/settings/metaherb-sso/page';

vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// DevExtreme editors are heavy + don't forward data-testid at the root, so
// stub them with plain inputs/buttons that honor the props the page passes.
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({
    value,
    onValueChanged,
    placeholder,
    inputAttr,
  }: {
    value?: string;
    onValueChanged?: (e: { value: string }) => void;
    placeholder?: string;
    inputAttr?: Record<string, unknown>;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      data-testid={(inputAttr?.['data-testid'] as string) ?? 'dx-text-box'}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    />
  ),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({
    text,
    onClick,
    disabled,
  }: {
    text?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button data-testid="metaherb-save-button" onClick={onClick} disabled={disabled}>
      {text}
    </button>
  ),
}));

const VIEW = {
  callbackUrl: 'https://api.pomdevth.site/api/sso/erp/callback/arjaro',
  secretConfigured: true,
  source: { secret: 'db', callback: 'db' },
};

describe('MetaherbSsoSettingsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init || init.method === undefined) {
          // GET load
          return { ok: true, json: async () => ({ success: true, data: VIEW }) } as Response;
        }
        // PUT save
        return { ok: true, json: async () => ({ success: true }) } as Response;
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders and loads existing config (callback shown, secret never revealed)', async () => {
    render(<MetaherbSsoSettingsPage />);

    // Page shell present
    expect(screen.getByTestId('metaherb-sso-settings')).toBeTruthy();

    // Callback URL populates from the API
    await waitFor(() => {
      const cb = screen.getByTestId('metaherb-callback-input') as HTMLInputElement;
      expect(cb.value).toBe(VIEW.callbackUrl);
    });

    // Secret input is empty (value never round-trips from the server)
    const secret = screen.getByTestId('metaherb-secret-input') as HTMLInputElement;
    expect(secret.value).toBe('');
  });

  it('PUTs callback + new secret on save', async () => {
    render(<MetaherbSsoSettingsPage />);
    await waitFor(() => screen.getByTestId('metaherb-callback-input'));

    const secret = screen.getByTestId('metaherb-secret-input');
    fireEvent.change(secret, { target: { value: 'new-secret-value-123456789012345678' } });

    fireEvent.click(screen.getByTestId('metaherb-save-button'));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const put = calls.find((c) => c[1]?.method === 'PUT');
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string);
      expect(body.callbackUrl).toBe(VIEW.callbackUrl);
      expect(body.ssoSecret).toBe('new-secret-value-123456789012345678');
    });
  });

  it('omits ssoSecret from the body when the secret field is left blank', async () => {
    render(<MetaherbSsoSettingsPage />);
    await waitFor(() => screen.getByTestId('metaherb-callback-input'));

    // Don't touch the secret field — just save.
    fireEvent.click(screen.getByTestId('metaherb-save-button'));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const put = calls.find((c) => c[1]?.method === 'PUT');
      expect(put).toBeTruthy();
      const body = JSON.parse((put![1] as RequestInit).body as string);
      expect('ssoSecret' in body).toBe(false); // unchanged secret not sent
      expect(body.callbackUrl).toBe(VIEW.callbackUrl);
    });
  });

  it('shows an error message when save returns success:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init || init.method === undefined) {
          return { ok: true, json: async () => ({ success: true, data: VIEW }) } as Response;
        }
        return { ok: false, json: async () => ({ success: false, error: 'บันทึกไม่สำเร็จ' }) } as Response;
      })
    );

    render(<MetaherbSsoSettingsPage />);
    await waitFor(() => screen.getByTestId('metaherb-callback-input'));
    fireEvent.click(screen.getByTestId('metaherb-save-button'));

    await waitFor(() => {
      const msg = screen.getByTestId('metaherb-sso-message');
      expect(msg.textContent).toContain('บันทึกไม่สำเร็จ');
    });
  });

  it('shows an error when the initial load fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );

    render(<MetaherbSsoSettingsPage />);
    await waitFor(() => {
      const msg = screen.getByTestId('metaherb-sso-message');
      expect(msg.textContent).toMatch(/โหลดการตั้งค่าไม่สำเร็จ/);
    });
  });
});
