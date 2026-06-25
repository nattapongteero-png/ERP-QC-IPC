/**
 * Sidebar — "Enter Metaherb" SSO handoff link
 * ────────────────────────────────────────────
 * Verifies the Metaherb SSO menu item added to the Purchasing group:
 *   - renders for purchasing/admin users
 *   - points at the token-minting API route /api/sso/metaherb
 *   - is a plain <a> (external full navigation), NOT a Next <Link>
 *   - sits immediately after the Vendors link
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/components/shared/language-switcher', () => ({
  SidebarLanguageToggle: () => null,
}));

function renderSidebar(role: string) {
  return render(
    <Sidebar user={{ name: 'Test User', email: 't@example.com', role }} />
  );
}

const METAHERB_HREF = '/api/sso/metaherb';

describe('Sidebar Metaherb SSO link', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the Metaherb handoff link for a purchasing user', () => {
    const { container } = renderSidebar('purchasing');
    const link = container.querySelector(`a[href="${METAHERB_HREF}"]`);
    expect(link).not.toBeNull();
  });

  it('places the Metaherb link immediately after Vendors', () => {
    const { container } = renderSidebar('admin');
    const hrefs = Array.from(container.querySelectorAll('a[href]')).map(
      (a) => a.getAttribute('href') as string
    );
    const vendorIdx = hrefs.indexOf('/purchasing/vendors');
    const metaherbIdx = hrefs.indexOf(METAHERB_HREF);
    expect(vendorIdx).toBeGreaterThanOrEqual(0);
    expect(metaherbIdx).toBe(vendorIdx + 1);
  });

  it('is hidden from roles without purchasing access (e.g. qc)', () => {
    const { container } = renderSidebar('qc');
    const link = container.querySelector(`a[href="${METAHERB_HREF}"]`);
    expect(link).toBeNull();
  });
});
