/**
 * users/new form — locale switching (TH ↔ EN)
 * ────────────────────────────────────────────
 * Verifies the i18n fix on the New User form (src/app/users/new/page.tsx),
 * which fully uses useTranslations('users'). Renders the page under a REAL
 * NextIntlClientProvider with the actual locale JSON loaded from disk and
 * asserts representative labels are Thai under locale='th' and English under
 * locale='en' — i.e. they do not stay stuck in one language.
 *
 * The global next-intl mock in tests/setup.ts always forces EN, so we
 * vi.unmock('next-intl') here and drive the real provider, exactly like
 * tests/integration/i18n-switch.test.tsx.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use the real next-intl (override the global EN-forcing mock).
vi.unmock('next-intl');

import * as fs from 'fs';
import * as path from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import NewUserPage from '@/app/users/new/page';

// next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

// VMI auto-sync hook pulls timers/network — stub it out.
vi.mock('@/hooks/use-vmi-auto-sync', () => ({
  useVmiAutoSync: () => undefined,
}));

// Notification bell hits an API on mount — render nothing.
vi.mock('@/components/equipment-notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

// Language switcher reads cookies — stub.
vi.mock('@/components/shared/language-switcher', () => ({
  CompactLanguageSwitcher: () => null,
  SidebarLanguageToggle: () => null,
}));

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
const messagesEn = loadMessages('en');

// Mock the session + lookup fetches the page makes on mount.
function installFetchMock() {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/api/auth/session')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { user: { id: 1, name: 'Admin', email: 'a@x.com', role: 'admin' } },
          }),
      });
    }
    if (url.includes('/api/hr/roles')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ id: 1, code: 'ADMIN', name: 'Admin', nameTh: 'ผู้ดูแล', isActive: true }],
          }),
      });
    }
    if (url.includes('/api/hr/org-units')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: [{ id: 1, name: 'QC', nameTh: 'ควบคุมคุณภาพ', type: 'dept', isActive: true }] }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
  });
  // @ts-expect-error test stub
  global.fetch = fetchMock;
  return fetchMock;
}

function renderAt(locale: 'th' | 'en') {
  const messages = locale === 'th' ? messagesTh : messagesEn;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Bangkok"
      onError={() => {}}
      getMessageFallback={({ namespace, key }) => (namespace ? `${namespace}.${key}` : key)}
    >
      <NewUserPage />
    </NextIntlClientProvider>
  );
}

// Representative labels from src/locales/{th,en}/users.json -> form.*
const EXPECTED = {
  createTitle: { th: 'สร้างผู้ใช้ใหม่', en: 'Create New User' },
  nameLabel: { th: 'ชื่อ-นามสกุล', en: 'Full Name' },
  sectionIdentity: { th: 'ข้อมูลส่วนตัว', en: 'Personal Information' },
  roleLabel: { th: 'บทบาท', en: 'Role' },
};

describe('users/new form locale switching', () => {
  beforeEach(() => {
    installFetchMock();
  });

  it('renders Thai labels under locale="th"', async () => {
    renderAt('th');
    await waitFor(() => {
      expect(screen.getByText(EXPECTED.createTitle.th)).toBeInTheDocument();
    });
    expect(screen.getByText(EXPECTED.sectionIdentity.th)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(EXPECTED.nameLabel.th))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(EXPECTED.roleLabel.th))).toBeInTheDocument();
    // English heading must NOT appear in Thai mode.
    expect(screen.queryByText(EXPECTED.createTitle.en)).not.toBeInTheDocument();
  });

  it('renders English labels under locale="en" (does not stay Thai)', async () => {
    renderAt('en');
    await waitFor(() => {
      expect(screen.getByText(EXPECTED.createTitle.en)).toBeInTheDocument();
    });
    expect(screen.getByText(EXPECTED.sectionIdentity.en)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(EXPECTED.nameLabel.en))).toBeInTheDocument();
    // Thai heading must NOT appear in English mode (proves the switch worked).
    expect(screen.queryByText(EXPECTED.createTitle.th)).not.toBeInTheDocument();
    expect(screen.queryByText(EXPECTED.sectionIdentity.th)).not.toBeInTheDocument();
  });
});
