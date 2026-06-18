/**
 * Sidebar child-link role gating
 * ──────────────────────────────
 * Verifies the fix in src/components/layout/sidebar.tsx (getFilteredNavigation):
 * lower-privileged HR roles (hr_staff) must NOT see the sensitive HR governance
 * sub-pages — Roles (/hr/roles), Authorizations (/hr/authorizations) and
 * Audit Trail (/hr/audit) — because those pages 403 on click. Admin / manager /
 * hr_admin must still see them.
 *
 * getFilteredNavigation is not exported, so we render the <Sidebar/> component
 * with different mock sessions and assert on the rendered child <a href> links.
 * Child links live in the DOM even when their parent group is collapsed (the
 * collapse is CSS-only), so href queries are reliable regardless of expand state.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';

// usePathname is the only next/navigation hook the Sidebar itself calls; the
// nested language toggle also calls useRouter, so provide both.
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

// The sidebar language toggle reads/writes cookies — stub it out so it doesn't
// touch document.cookie during the render.
vi.mock('@/components/shared/language-switcher', () => ({
  SidebarLanguageToggle: () => null,
}));

// Sensitive HR governance sub-pages that must be hidden from hr_staff.
const SENSITIVE_HR_HREFS = ['/hr/roles', '/hr/authorizations', '/hr/audit'];
// HR sub-pages that every HR role (including hr_staff) is allowed to see.
const OPEN_HR_HREFS = ['/hr/employees', '/hr/positions', '/hr/training', '/hr/health-records'];

function renderSidebar(role: string) {
  return render(
    <Sidebar user={{ name: 'Test User', email: 't@example.com', role }} />
  );
}

function childHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a[href]')).map(
    (a) => a.getAttribute('href') as string
  );
}

describe('Sidebar HR child-link role gating', () => {
  beforeEach(() => {
    cleanup();
  });

  it('hides Roles / Authorizations / Audit Trail from hr_staff', () => {
    const { container } = renderSidebar('hr_staff');
    const hrefs = childHrefs(container);

    // hr_staff still sees the HR module and its open sub-pages...
    expect(hrefs).toContain('/hr/org');
    for (const href of OPEN_HR_HREFS) {
      expect(hrefs).toContain(href);
    }
    // ...but NOT the governance sub-pages.
    for (const href of SENSITIVE_HR_HREFS) {
      expect(hrefs).not.toContain(href);
    }
  });

  it('shows all HR sub-pages to hr_admin', () => {
    const { container } = renderSidebar('hr_admin');
    const hrefs = childHrefs(container);

    for (const href of [...OPEN_HR_HREFS, ...SENSITIVE_HR_HREFS]) {
      expect(hrefs).toContain(href);
    }
  });

  it('shows all HR sub-pages to manager (catch-all)', () => {
    const { container } = renderSidebar('manager');
    const hrefs = childHrefs(container);

    for (const href of SENSITIVE_HR_HREFS) {
      expect(hrefs).toContain(href);
    }
  });

  it('shows all HR sub-pages to admin (bypass)', () => {
    const { container } = renderSidebar('admin');
    const hrefs = childHrefs(container);

    for (const href of SENSITIVE_HR_HREFS) {
      expect(hrefs).toContain(href);
    }
  });

  it('hides the entire Settings/Admin modules from hr_staff but keeps HR', () => {
    const { container } = renderSidebar('hr_staff');
    const hrefs = childHrefs(container);

    // HR module is visible to hr_staff
    expect(hrefs.some((h) => h.startsWith('/hr/'))).toBe(true);
    // Admin module (admin-only) and its child are not
    expect(hrefs).not.toContain('/admin/confidential-groups');
    // Settings (admin/manager only) child links not present
    expect(hrefs).not.toContain('/settings/approval-workflows');
  });

  it('uppercase HR role code HR_STAFF expands and also hides governance pages', () => {
    // expandRole('HR_STAFF') -> ['hr_staff','hr']; should behave like hr_staff.
    const { container } = renderSidebar('HR_STAFF');
    const hrefs = childHrefs(container);

    expect(hrefs).toContain('/hr/employees');
    for (const href of SENSITIVE_HR_HREFS) {
      expect(hrefs).not.toContain(href);
    }
  });

  it('HR_ADMIN uppercase code sees the governance pages', () => {
    const { container } = renderSidebar('HR_ADMIN');
    const hrefs = childHrefs(container);

    for (const href of SENSITIVE_HR_HREFS) {
      expect(hrefs).toContain(href);
    }
  });
});
