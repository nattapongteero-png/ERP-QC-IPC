/**
 * Module hub pages — /gmp, /quality, /admin.
 *
 * These pages exist because the sidebar's parent entries point at those hrefs.
 * Before they existed, Next prefetched them and 404'd, and a user landing on the
 * URL directly (bookmark, pasted link) got a 404.
 *
 * The link-target test is the regression guard: every card must point at a route
 * that actually has a page.tsx. That is the class of bug this whole change fixes,
 * so it is worth asserting on disk rather than trusting the href strings.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { NextIntlClientProvider } from 'next-intl';

import GmpHubPage from '@/app/gmp/page';
import AdminHubPage from '@/app/admin/page';

import thGmp from '@/locales/th/gmp.json';
import thAdmin from '@/locales/th/admin.json';
import enGmp from '@/locales/en/gmp.json';
import enAdmin from '@/locales/en/admin.json';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ROOT = process.cwd();

/** A route is reachable iff src/app/<route>/page.tsx exists. */
function routeExists(href: string): boolean {
  const rel = href.replace(/^\//, '');
  return fs.existsSync(path.join(ROOT, 'src', 'app', rel, 'page.tsx'));
}

function renderWithIntl(ui: React.ReactElement, messages: Record<string, unknown>) {
  return render(
    <NextIntlClientProvider locale="th" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

// /quality deliberately has no hub page — next.config redirects it to
// /quality/qc-entry ("QC Entry is the Quality module home"). Asserted below.
const HUBS = [
  {
    name: 'GMP',
    Page: GmpHubPage,
    th: { gmp: thGmp },
    en: { gmp: enGmp },
    testidPrefix: 'gmp-card-',
    expectedCards: 10,
  },
  {
    name: 'Admin',
    Page: AdminHubPage,
    th: { admin: thAdmin },
    en: { admin: enAdmin },
    testidPrefix: 'admin-card-',
    expectedCards: 1,
  },
];

describe.each(HUBS)('$name hub page', ({ Page, th, en, testidPrefix, expectedCards }) => {
  it('renders without crashing and shows every card', () => {
    const { container } = renderWithIntl(<Page />, th);
    const cards = container.querySelectorAll(`[data-testid^="${testidPrefix}"]`);
    expect(cards).toHaveLength(expectedCards);
  });

  it('renders in English too (both locales have the hub keys)', () => {
    const { container } = renderWithIntl(<Page />, en);
    const cards = container.querySelectorAll(`[data-testid^="${testidPrefix}"]`);
    expect(cards).toHaveLength(expectedCards);
  });

  it('never renders a raw translation key', () => {
    const { container } = renderWithIntl(<Page />, th);
    // next-intl echoes the key path back when a message is missing.
    expect(container.textContent).not.toMatch(/hub\.\w+\.(title|desc)/);
  });

  it('every card links to a route that exists on disk', () => {
    const { container } = renderWithIntl(<Page />, th);
    const hrefs = Array.from(
      container.querySelectorAll(`[data-testid^="${testidPrefix}"]`)
    ).map((a) => a.getAttribute('href')!);

    expect(hrefs.length).toBe(expectedCards);
    const broken = hrefs.filter((h) => !routeExists(h));
    expect(broken, `broken links: ${broken.join(', ')}`).toEqual([]);
  });
});

/** next.config declares redirects; a redirected source is reachable without a page.tsx. */
function isRedirected(href: string): boolean {
  const cfg = fs.readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8');
  return new RegExp(`source:\\s*'${href}'`).test(cfg);
}

describe('sidebar parent hrefs do not 404', () => {
  // The original bug: sidebar parents pointed at /gmp and /admin, neither of
  // which had a page.tsx, so Next prefetched them into a 404 and a user who
  // pasted the URL got a 404. A parent is fine if it EITHER has a page.tsx OR
  // is redirected (that is how /quality works — it goes to /quality/qc-entry).
  it.each(['/gmp', '/admin', '/quality', '/premises', '/production'])(
    '%s resolves (page or redirect)',
    (href) => {
      const reachable = routeExists(href) || isRedirected(href);
      expect(reachable, `${href} has neither a page.tsx nor a redirect`).toBe(true);
    }
  );
});

describe('executive dashboard alert action links', () => {
  // These are rendered as clickable actions on the executive dashboard. They
  // pointed at /accounting/{cash-flow,profitability,fiscal-periods}, none of
  // which exist — an exec clicking the alert got a 404.
  it('every actionLink in executive-dashboard.service points at a real route', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/lib/services/executive-dashboard.service.ts'),
      'utf8'
    );
    const links = Array.from(src.matchAll(/actionLink:\s*'([^']+)'/g)).map((m) => m[1]);

    expect(links.length).toBeGreaterThan(0);
    const broken = links.filter((l) => !routeExists(l));
    expect(broken, `broken actionLinks: ${broken.join(', ')}`).toEqual([]);
  });
});
