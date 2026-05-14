/**
 * BOM List Page - Default Page Size Tests
 *
 * Tests that the BOM registry DataGrid defaults to 20 items per page
 * and has sufficient height (650px) to display all rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import BOMDashboardPage from '@/app/production/bom/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import { PRODUCTION_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Track DxPaging and DxDataGrid props
let capturedPagingProps: { defaultPageSize?: number } | null = null;
let capturedGridProps: { height?: number } | null = null;

// Mock the wrapper component (used by the BOM page)
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: (props: any) => {
    capturedGridProps = { height: props.height };
    return <div data-testid="data-grid">{props.children}</div>;
  },
  DxColumn: () => null,
  DxPaging: (props: any) => {
    capturedPagingProps = { defaultPageSize: props.defaultPageSize };
    return null;
  },
  DxSearchPanel: () => null,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: (props: any) => <button onClick={props.onClick}>{props.text}</button>,
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: (props: any) => <select value={props.value}><option>-</option></select>,
}));

// Mock DevExtreme PieChart
vi.mock('devextreme-react/pie-chart', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));

describe('BOM List Page - Paging Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
    capturedPagingProps = null;
    capturedGridProps = null;
  });

  it('should set default page size to 20', async () => {
    setupFetchMock(PRODUCTION_FETCH_HANDLERS);
    renderWithProviders(<BOMDashboardPage />);

    await waitFor(() => {
      expect(capturedPagingProps).not.toBeNull();
    });

    expect(capturedPagingProps?.defaultPageSize).toBe(20);
  });

  it('should set DataGrid height to 650px to fit 20 rows', async () => {
    setupFetchMock(PRODUCTION_FETCH_HANDLERS);
    renderWithProviders(<BOMDashboardPage />);

    await waitFor(() => {
      expect(capturedGridProps).not.toBeNull();
    });

    expect(capturedGridProps?.height).toBe(650);
  });

  it('should render BOM Registry section', async () => {
    setupFetchMock(PRODUCTION_FETCH_HANDLERS);
    renderWithProviders(<BOMDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('BOM Registry')).toBeInTheDocument();
    });
  });
});
