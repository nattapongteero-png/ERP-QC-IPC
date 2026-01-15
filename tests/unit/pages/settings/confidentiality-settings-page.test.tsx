/**
 * Confidentiality Settings Page Tests
 * Feature: 014-unit-cost - BOM Confidentiality Protection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock MainLayout since it may have complex dependencies
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid={`link-${href}`}>{children}</a>
  ),
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Sample bypass roles data
const MOCK_BYPASS_ROLES = {
  roles: ['ADMIN', 'MANAGER'],
};

// Create a wrapper with query client
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Setup fetch mock
function setupFetchMock(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data }),
  });
}

describe('ConfidentialitySettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title after loading', async () => {
      setupFetchMock(MOCK_BYPASS_ROLES);

      // Dynamic import to avoid hoisting issues
      const { default: ConfidentialitySettingsPage } = await import(
        '@/app/settings/confidentiality/page'
      );

      render(<ConfidentialitySettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Confidentiality Settings')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should render info banner about bypass roles', async () => {
      setupFetchMock(MOCK_BYPASS_ROLES);

      const { default: ConfidentialitySettingsPage } = await import(
        '@/app/settings/confidentiality/page'
      );

      render(<ConfidentialitySettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/About Confidentiality Bypass Roles/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should render available roles', async () => {
      setupFetchMock(MOCK_BYPASS_ROLES);

      const { default: ConfidentialitySettingsPage } = await import(
        '@/app/settings/confidentiality/page'
      );

      render(<ConfidentialitySettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Administrator')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should render link to access control groups', async () => {
      setupFetchMock(MOCK_BYPASS_ROLES);

      const { default: ConfidentialitySettingsPage } = await import(
        '@/app/settings/confidentiality/page'
      );

      render(<ConfidentialitySettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Access Control Groups')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should show role count summary', async () => {
      setupFetchMock(MOCK_BYPASS_ROLES);

      const { default: ConfidentialitySettingsPage } = await import(
        '@/app/settings/confidentiality/page'
      );

      render(<ConfidentialitySettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // 2 roles selected (ADMIN, MANAGER) - text is "2 roles can bypass"
        expect(screen.getByText(/can bypass confidentiality/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Selected Roles', () => {
    it('should highlight selected roles', async () => {
      setupFetchMock(MOCK_BYPASS_ROLES);

      const { default: ConfidentialitySettingsPage } = await import(
        '@/app/settings/confidentiality/page'
      );

      render(<ConfidentialitySettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const adminItem = screen.getByTestId('role-item-ADMIN');
        expect(adminItem).toHaveClass('bg-blue-50');
      }, { timeout: 5000 });
    });
  });
});
