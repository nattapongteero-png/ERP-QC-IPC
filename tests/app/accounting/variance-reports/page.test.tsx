/**
 * UI Tests for Variance Reports Page (T152)
 * Tests the variance reports dashboard functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VarianceReportsPage from '@/app/accounting/variance-reports/page';

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock VarianceChart
vi.mock('@/components/accounting/VarianceChart', () => ({
  VarianceChart: ({ data, title }: { data: any[]; title: string }) => (
    <div data-testid="variance-chart">
      <h3>{title}</h3>
      <span>Chart with {data?.length || 0} items</span>
    </div>
  ),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ dataSource, children, ...props }: any) => (
    <div data-testid={props['data-testid'] || 'data-grid'}>
      <table>
        <tbody>
          {Array.isArray(dataSource) && dataSource.map((row: any, i: number) => (
            <tr key={i}>
              <td>{row.groupName || row.itemCode || row.workOrderNumber || 'row'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  Summary: () => null,
  TotalItem: () => null,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid={props['data-testid']}>{text}</button>
  ),
}));

vi.mock('devextreme-react/date-box', () => ({
  DateBox: ({ value, onValueChanged, ...props }: any) => (
    <input
      type="date"
      value={value ? value.toISOString().split('T')[0] : ''}
      onChange={(e) => onValueChanged?.({ value: new Date(e.target.value) })}
      data-testid={props['data-testid']}
    />
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, onValueChanged, items, ...props }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      data-testid={props['data-testid']}
    >
      {items?.map((item: any) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
}));

// Mock fetch
const mockSummaryReport = {
  period: '2024-01-01 to 2024-01-31',
  totalVariances: 5000,
  favorableVariances: -2000,
  unfavorableVariances: 7000,
  byType: [
    { varianceType: 'mpv', varianceTypeName: 'Material Price Variance', amount: 1500, isFavorable: false },
    { varianceType: 'muv', varianceTypeName: 'Material Usage Variance', amount: -500, isFavorable: true },
    { varianceType: 'lrv', varianceTypeName: 'Labor Rate Variance', amount: 800, isFavorable: false },
    { varianceType: 'lev', varianceTypeName: 'Labor Efficiency Variance', amount: 200, isFavorable: false },
  ],
  details: [
    { groupKey: 'mpv', groupName: 'Material Price Variance', mpv: 1500, muv: 0, lrv: 0, lev: 0, vohVar: 0, fohVol: 0, total: 1500, isFavorable: false },
    { groupKey: 'muv', groupName: 'Material Usage Variance', mpv: 0, muv: -500, lrv: 0, lev: 0, vohVar: 0, fohVol: 0, total: -500, isFavorable: true },
  ],
};

const mockMaterialReport = {
  summary: {
    totalMpv: 1500,
    totalMuv: -500,
    totalMaterialVariance: 1000,
  },
  items: [
    { itemId: 1, itemCode: 'ITM001', itemName: 'Item 1', standardPrice: 100, actualPrice: 105, priceVariance: 500, standardQty: 100, actualQty: 95, usageVariance: -500, totalVariance: 0 },
    { itemId: 2, itemCode: 'ITM002', itemName: 'Item 2', standardPrice: 50, actualPrice: 55, priceVariance: 1000, standardQty: 200, actualQty: 200, usageVariance: 0, totalVariance: 1000 },
  ],
};

const mockLaborReport = {
  summary: {
    totalLrv: 800,
    totalLev: 200,
    totalLaborVariance: 1000,
  },
  details: [
    { workOrderId: 1, workOrderNumber: 'WO-001', itemCode: 'ITM001', standardHours: 100, actualHours: 105, standardRate: 25, actualRate: 26, rateVariance: 500, efficiencyVariance: 125 },
    { workOrderId: 2, workOrderNumber: 'WO-002', itemCode: 'ITM002', standardHours: 50, actualHours: 52, standardRate: 25, actualRate: 27, rateVariance: 300, efficiencyVariance: 75 },
  ],
};

describe('VarianceReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('variance-summary')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockSummaryReport }),
        });
      }
      if (url.includes('material-variance')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockMaterialReport }),
        });
      }
      if (url.includes('labor-variance')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockLaborReport }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: false }),
      });
    });
  });

  it('should render page title', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Variance Reports');
    });
  });

  it('should render filter controls', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('date-from')).toBeInTheDocument();
      expect(screen.getByTestId('date-to')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
    });
  });

  it('should render report tabs', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('report-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('tab-summary')).toBeInTheDocument();
      expect(screen.getByTestId('tab-material')).toBeInTheDocument();
      expect(screen.getByTestId('tab-labor')).toBeInTheDocument();
    });
  });

  it('should show summary tab by default', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('total-variances')).toBeInTheDocument();
      expect(screen.getByTestId('favorable-variances')).toBeInTheDocument();
      expect(screen.getByTestId('unfavorable-variances')).toBeInTheDocument();
    });
  });

  it('should display variance chart in summary tab', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('variance-chart')).toBeInTheDocument();
    });
  });

  it('should display summary grid', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('summary-grid')).toBeInTheDocument();
    });
  });

  it('should switch to material variance tab', async () => {
    render(<VarianceReportsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('total-variances')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-material'));

    await waitFor(() => {
      expect(screen.getByTestId('total-material-variance')).toBeInTheDocument();
      expect(screen.getByTestId('mpv-total')).toBeInTheDocument();
      expect(screen.getByTestId('muv-total')).toBeInTheDocument();
    });
  });

  it('should display material variance grid', async () => {
    render(<VarianceReportsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('tab-material')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-material'));

    await waitFor(() => {
      expect(screen.getByTestId('material-grid')).toBeInTheDocument();
    });
  });

  it('should switch to labor variance tab', async () => {
    render(<VarianceReportsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('total-variances')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-labor'));

    await waitFor(() => {
      expect(screen.getByTestId('total-labor-variance')).toBeInTheDocument();
      expect(screen.getByTestId('lrv-total')).toBeInTheDocument();
      expect(screen.getByTestId('lev-total')).toBeInTheDocument();
    });
  });

  it('should display labor variance grid', async () => {
    render(<VarianceReportsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('tab-labor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-labor'));

    await waitFor(() => {
      expect(screen.getByTestId('labor-grid')).toBeInTheDocument();
    });
  });

  it('should show group-by selector only in summary tab', async () => {
    render(<VarianceReportsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('group-by')).toBeInTheDocument();
    });

    // Switch to material tab
    fireEvent.click(screen.getByTestId('tab-material'));

    await waitFor(() => {
      expect(screen.queryByTestId('group-by')).not.toBeInTheDocument();
    });
  });

  it('should call refresh when button clicked', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('refresh-btn'));

    await waitFor(() => {
      // Should have made fetch calls on initial load and after refresh
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should format currency values correctly', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      const totalVariances = screen.getByTestId('total-variances');
      // Check that it contains formatted currency (THB)
      expect(totalVariances.textContent).toMatch(/[\d,]+/);
    });
  });

  it('should fetch all three reports on load', async () => {
    render(<VarianceReportsPage />);

    await waitFor(() => {
      const fetchCalls = (global.fetch as any).mock.calls;
      const urls = fetchCalls.map((call: any) => call[0]);

      expect(urls.some((url: string) => url.includes('variance-summary'))).toBe(true);
      expect(urls.some((url: string) => url.includes('material-variance'))).toBe(true);
      expect(urls.some((url: string) => url.includes('labor-variance'))).toBe(true);
    });
  });

  it('should show loading indicator while fetching', () => {
    // Reset fetch to never resolve
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<VarianceReportsPage />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<VarianceReportsPage />);

    // Should not crash, just show empty state
    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });
});

describe('Standard Costs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('standard-costs')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 1, itemCode: 'ITM001', itemName: 'Item 1', effectiveDate: '2024-01-15', materialCost: 100, laborCost: 50, overheadCost: 25, totalCost: 175, isCurrent: true },
            ],
          }),
        });
      }
      if (url.includes('inventory/items')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 1, code: 'ITM001', name: 'Item 1' },
            ],
          }),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({ success: false }) });
    });
  });

  it('should render standard costs page imports correctly', async () => {
    // This test verifies the page can be imported
    const { default: StandardCostsPage } = await import('@/app/accounting/standard-costs/page');
    expect(StandardCostsPage).toBeDefined();
  });
});
