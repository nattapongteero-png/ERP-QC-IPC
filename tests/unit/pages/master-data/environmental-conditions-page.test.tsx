/**
 * Environmental Conditions Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import EnvironmentalConditionsPage from '@/app/master-data/environmental-conditions/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_ENVIRONMENTAL_CONDITIONS, MASTER_DATA_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons (Proxy returns a stub for ANY icon name)
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name }
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    }
  );
});

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

// Mock DevExtreme components
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children }: { children?: React.ReactNode }) => <div data-testid="dx-data-grid">{children}</div>,
  DxColumn: () => null,
  DxPaging: () => null,
  DxSearchPanel: () => null,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('EnvironmentalConditionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Environmental Conditions')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/environmental condition profiles/)).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });

    it('should render Add Condition button', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Add Condition')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch environmental conditions on mount', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const conditionsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/master-data/environmental-conditions')
      );
      expect(conditionsCall).toBeDefined();
    });

    it('should handle empty conditions data gracefully', async () => {
      setupFetchMock({
        '/api/master-data/environmental-conditions': { data: createSingleResponse([]) },
      });

      renderWithProviders(<EnvironmentalConditionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Environmental Conditions')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/master-data/environmental-conditions': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<EnvironmentalConditionsPage />);

      // Page should still render header even on API error
      await waitFor(() => {
        expect(screen.getByText('Environmental Conditions')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const conditionsResponse = createSingleResponse(MOCK_ENVIRONMENTAL_CONDITIONS);

      // Correct: data returns the array directly
      expect(Array.isArray(conditionsResponse.data)).toBe(true);
      expect(conditionsResponse.data.length).toBe(MOCK_ENVIRONMENTAL_CONDITIONS.length);
    });
  });
});
