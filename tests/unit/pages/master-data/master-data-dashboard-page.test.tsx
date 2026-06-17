/**
 * Master Data Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MasterDataPage from '@/app/master-data/page';
import {
  renderWithProviders,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons — Proxy returns a stub component for ANY icon name,
// so newly imported icons can never break this test.
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name },
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    },
  );
});

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

// Mock useToast — the page uses it for import success/error notifications
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

describe('MasterDataPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText('Master Data')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        // Subtitle comes from i18n key page.description (masterData.json).
        expect(
          screen.getByText(/Manage master data used by other screens/),
        ).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });
  });

  describe('Module Cards', () => {
    it('should render Production Rooms card', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        // Text appears in both card and info section, so check for the description
        expect(screen.getByText('Manage production rooms and areas for GMP compliance')).toBeInTheDocument();
      });
    });

    it('should render Production Equipment card', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText('Manage production equipment like scales, mixers, and tools')).toBeInTheDocument();
      });
    });

    it('should render Environmental Conditions card', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText('Define temperature and humidity monitoring profiles')).toBeInTheDocument();
      });
    });

    it('should render SOP Templates card', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText('Create reusable SOP step templates for production processes')).toBeInTheDocument();
      });
    });

    it('should render Packaging QC Criteria card', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText('Define packaging weight and quality control criteria')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Links', () => {
    it('should have correct href for Production Rooms', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /production rooms/i });
        expect(link).toHaveAttribute('href', '/master-data/production-rooms');
      });
    });

    it('should have correct href for Production Equipment', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /production equipment/i });
        expect(link).toHaveAttribute('href', '/master-data/production-equipment');
      });
    });

    it('should have correct href for Environmental Conditions', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /environmental conditions/i });
        expect(link).toHaveAttribute('href', '/master-data/environmental-conditions');
      });
    });

    it('should have correct href for SOP Templates', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /sop templates/i });
        expect(link).toHaveAttribute('href', '/master-data/sop-templates');
      });
    });

    it('should have correct href for Packaging QC Criteria', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /packaging qc criteria/i });
        expect(link).toHaveAttribute('href', '/master-data/packaging-qc-criteria');
      });
    });
  });

  describe('Info Card', () => {
    it('should render About Master Data section', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText('About Master Data')).toBeInTheDocument();
      });
    });

    it('should describe master data functionality', async () => {
      renderWithProviders(<MasterDataPage />);

      await waitFor(() => {
        expect(screen.getByText(/Master Data defines the lookup lists/)).toBeInTheDocument();
      });
    });
  });
});
