/**
 * HR dashboard quick-action links
 * ───────────────────────────────
 * Verifies the fix in src/app/hr/page.tsx: the "Add Employee" and
 * "Create Course" quick actions link to the dedicated create routes
 * (/hr/employees/new and /hr/training/courses/new) — NOT the old
 * ?action=new query-string variant that 404'd / no-op'd.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HRDashboardPage from '@/app/hr/page';

// Stat cards query the HR API; stub fetch so the query resolves cleanly.
vi.stubGlobal(
  'fetch',
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: { data: [] } }),
    })
  )
);

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <HRDashboardPage />
    </QueryClientProvider>
  );
}

describe('HR dashboard quick actions', () => {
  it('Add Employee links to /hr/employees/new (not ?action=new)', () => {
    const { container } = renderDashboard();
    const links = Array.from(container.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href')
    );

    expect(links).toContain('/hr/employees/new');
    expect(links).toContain('/hr/training/courses/new');

    // No quick-action link should use the deprecated ?action=new pattern.
    expect(links.some((h) => h?.includes('?action=new'))).toBe(false);
  });

  it('quick-action container renders the create links', () => {
    renderDashboard();
    const quickActions = screen.getByTestId('hr-quick-actions');
    const hrefs = Array.from(quickActions.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toContain('/hr/employees/new');
    expect(hrefs).toContain('/hr/training/courses/new');
    expect(hrefs).toContain('/hr/training/matrix');
    expect(hrefs).toContain('/hr/notifications');
  });
});
