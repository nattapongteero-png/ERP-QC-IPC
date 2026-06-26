/**
 * users/[id] — HR employee link card
 * ──────────────────────────────────
 * Covers the "ผูกกับพนักงาน (HR)" section on the user-detail page
 * (src/app/users/[id]/page.tsx). Linking sets hr_employees.user_id, which the
 * Metaherb SSO handoff sends as an OPTIONAL requesterId — the handoff works
 * with or without a link, but linking lets Metaherb attribute the requester.
 *
 * DevExtreme widgets hang under jsdom, so the dx-* wrappers are mocked with
 * plain HTML (the repo's standard pattern, e.g. tests/app/production/bom/
 * new-page.test.tsx). That lets us drive the real page logic: render status,
 * change the selection, click save, and assert the PUT to /employee-link.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.unmock('next-intl');

import * as fs from 'fs';
import * as path from 'path';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

// MainLayout pulls in sidebar/notification/network — render children only.
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// --- DevExtreme wrappers → lightweight HTML (DevExtreme hangs in jsdom) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('@/components/ui/dx-select-box', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DxSelectBox: ({ items, value, onValueChange, ...rest }: any) => (
    <select
      data-testid={rest['data-testid']}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        onValueChange?.(raw === '' ? null : Number(raw));
      }}
    >
      {(items || []).map((it: any, i: number) => (
        <option key={i} value={it.value === null || it.value === undefined ? '' : String(it.value)} disabled={it.disabled}>
          {it.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock('@/components/ui/dx-button', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DxButton: ({ text, onClick, disabled, ...rest }: any) => (
    <button data-testid={rest['data-testid']} onClick={onClick} disabled={disabled}>
      {text}
    </button>
  ),
}));
vi.mock('@/components/ui/dx-text-box', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DxTextBox: ({ value, onValueChange, ...rest }: any) => (
    <input
      data-testid={rest['data-testid']}
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));
vi.mock('@/components/ui/dx-load-indicator', () => ({
  DxLoadIndicator: () => <div data-testid="load-indicator" />,
}));
vi.mock('@/components/ui/dx-popup', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DxPopup: ({ visible, children }: any) => (visible ? <div data-testid="popup">{children}</div> : null),
}));

// Imported AFTER mocks so the page picks up the mocked widgets.
import UserDetailPage from '@/app/users/[id]/page';

function loadMessages(locale: 'th' | 'en'): Record<string, unknown> {
  const dir = path.resolve(process.cwd(), 'src/locales', locale);
  const messages: Record<string, unknown> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const ns = file.replace('.json', '');
    messages[ns] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
  }
  return messages;
}

const messagesTh = loadMessages('th');

const EMPLOYEES = [
  { id: 10, userId: null, employeeCode: 'EMP010', firstName: 'สมชาย', lastName: 'ใจดี' },
  { id: 11, userId: 99, employeeCode: 'EMP011', firstName: 'อื่น', lastName: 'ผูกแล้ว' },
];

function installFetchMock(linkedEmployee: unknown) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/employee-link')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { employeeId: 10 } }),
      });
    }
    if (/\/api\/users\/1$/.test(url)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 1,
              email: 'admin@herbal-erp.com',
              name: 'System Administrator',
              role: 'admin',
              department: null,
              isActive: true,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              linkedEmployee,
            },
          }),
      });
    }
    if (url.includes('/api/hr/employees')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: EMPLOYEES }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
  });
  // @ts-expect-error test stub
  global.fetch = fetchMock;
  return fetchMock;
}

function renderPage() {
  return render(
    <NextIntlClientProvider
      locale="th"
      messages={messagesTh}
      timeZone="Asia/Bangkok"
      onError={() => {}}
      getMessageFallback={({ namespace, key }) => (namespace ? `${namespace}.${key}` : key)}
    >
      <UserDetailPage />
    </NextIntlClientProvider>
  );
}

describe('users/[id] HR employee link card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the link card and "not linked" warning when user has no employee', async () => {
    installFetchMock(null);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('ผูกกับพนักงาน (HR)')).toBeInTheDocument();
    });
    expect(screen.getByText(/ยังไม่ได้ผูกกับพนักงาน/)).toBeInTheDocument();
    expect(screen.getByTestId('user-employee-link-select')).toBeInTheDocument();
  });

  it('shows the linked employee badge when an employee is linked', async () => {
    installFetchMock({ id: 10, employeeCode: 'EMP010', fullName: 'สมชาย ใจดี' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('สมชาย ใจดี')).toBeInTheDocument();
    });
    expect(screen.getByText('EMP010')).toBeInTheDocument();
    expect(screen.getByText('ผูกแล้ว')).toBeInTheDocument();
  });

  it('PUTs the selected employeeId to /employee-link when saving', async () => {
    const fetchMock = installFetchMock(null);
    renderPage();

    const select = await screen.findByTestId('user-employee-link-select');
    // Choose employee 10 (unlinked → selectable).
    fireEvent.change(select, { target: { value: '10' } });

    const saveBtn = screen.getByTestId('user-employee-link-save-btn');
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/users/1/employee-link',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ employeeId: 10 }),
        })
      );
    });
  });
});
