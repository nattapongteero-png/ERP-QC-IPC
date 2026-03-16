/**
 * Variance Reports E2E Test (T157)
 * Feature: 011-accounting-spec-gap
 * User Story 6: Manufacturing Variance Analysis
 *
 * Tests the Variance Reports page rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/accounting/variance-reports',
}));

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    TrendingUp: MockIcon,
    TrendingDown: MockIcon,
    BarChart: MockIcon,
    RefreshCw: MockIcon,
    Download: MockIcon,
    Filter: MockIcon,
    Calendar: MockIcon,
    DollarSign: MockIcon,
    AlertCircle: MockIcon,
    Loader2: MockIcon,
    CheckCircle: MockIcon,
    XCircle: MockIcon,
  };
});

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
            <tr key={i} data-testid={`grid-row-${i}`}>
              <td>{row.groupName || row.itemCode || row.workOrderNumber}</td>
              <td>{row.total}</td>
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
  LoadIndicator: () => <div data-testid="dx-loadindicator">Loading...</div>,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample variance summary report
const mockSummaryReport = {
  period: '2024-01-01 to 2024-01-31',
  totalVariances: 15000,
  favorableVariances: -5000,
  unfavorableVariances: 20000,
  byType: [
    { varianceType: 'mpv', varianceTypeName: 'Material Price Variance', amount: 8000, isFavorable: false },
    { varianceType: 'muv', varianceTypeName: 'Material Usage Variance', amount: -3000, isFavorable: true },
    { varianceType: 'lrv', varianceTypeName: 'Labor Rate Variance', amount: 5000, isFavorable: false },
    { varianceType: 'lev', varianceTypeName: 'Labor Efficiency Variance', amount: 5000, isFavorable: false },
  ],
  details: [
    { groupKey: 'mpv', groupName: 'Material Price Variance', mpv: 8000, muv: 0, lrv: 0, lev: 0, vohVar: 0, fohVol: 0, total: 8000, isFavorable: false },
    { groupKey: 'muv', groupName: 'Material Usage Variance', mpv: 0, muv: -3000, lrv: 0, lev: 0, vohVar: 0, fohVol: 0, total: -3000, isFavorable: true },
  ],
};

// Sample material variance report
const mockMaterialReport = {
  summary: {
    totalMpv: 8000,
    totalMuv: -3000,
    totalMaterialVariance: 5000,
  },
  items: [
    { itemId: 1, itemCode: 'RM-001', itemName: 'Raw Material A', standardPrice: 100, actualPrice: 108, priceVariance: 800, standardQty: 100, actualQty: 95, usageVariance: -500, totalVariance: 300 },
    { itemId: 2, itemCode: 'RM-002', itemName: 'Raw Material B', standardPrice: 50, actualPrice: 55, priceVariance: 500, standardQty: 100, actualQty: 100, usageVariance: 0, totalVariance: 500 },
  ],
};

// Sample labor variance report
const mockLaborReport = {
  summary: {
    totalLrv: 5000,
    totalLev: 5000,
    totalLaborVariance: 10000,
  },
  details: [
    { workOrderId: 1, workOrderNumber: 'WO-2024-001', itemCode: 'FG-001', standardHours: 100, actualHours: 110, standardRate: 25, actualRate: 27, rateVariance: 2700, efficiencyVariance: 2500 },
    { workOrderId: 2, workOrderNumber: 'WO-2024-002', itemCode: 'FG-002', standardHours: 80, actualHours: 85, standardRate: 25, actualRate: 26, rateVariance: 850, efficiencyVariance: 1250 },
  ],
};

describe('Variance Reports Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('variance-summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSummaryReport }),
        });
      }
      if (url.includes('material-variance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockMaterialReport }),
        });
      }
      if (url.includes('labor-variance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockLaborReport }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  it('should render page title', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      // Page uses t('page.title') = 'Accounting' as title
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });

  it('should render date filters', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('date-from')).toBeInTheDocument();
      expect(screen.getByTestId('date-to')).toBeInTheDocument();
    });
  });

  it('should render refresh button', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
    });
  });

  it('should render report tabs', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-summary')).toBeInTheDocument();
      expect(screen.getByTestId('tab-material')).toBeInTheDocument();
      expect(screen.getByTestId('tab-labor')).toBeInTheDocument();
    });
  });

  it('should display summary KPI cards', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('total-variances')).toBeInTheDocument();
      expect(screen.getByTestId('favorable-variances')).toBeInTheDocument();
      expect(screen.getByTestId('unfavorable-variances')).toBeInTheDocument();
    });
  });

  it('should display variance chart', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('variance-chart')).toBeInTheDocument();
    });
  });

  it('should display summary grid', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('summary-grid')).toBeInTheDocument();
    });
  });

  it('should fetch all reports on mount', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      const fetchCalls = mockFetch.mock.calls.map((call: any) => call[0]);
      expect(fetchCalls.some((url: string) => url.includes('variance-summary'))).toBe(true);
      expect(fetchCalls.some((url: string) => url.includes('material-variance'))).toBe(true);
      expect(fetchCalls.some((url: string) => url.includes('labor-variance'))).toBe(true);
    });
  });

  it('should show loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    expect(screen.getByTestId('dx-loadindicator')).toBeInTheDocument();
  });
});

describe('Variance Reports Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('variance-summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSummaryReport }),
        });
      }
      if (url.includes('material-variance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockMaterialReport }),
        });
      }
      if (url.includes('labor-variance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockLaborReport }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  it('should switch to material tab when clicked', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('total-variances')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-material'));

    await waitFor(() => {
      expect(screen.getByTestId('material-grid')).toBeInTheDocument();
    });
  });

  it('should switch to labor tab when clicked', async () => {
    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('total-variances')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-labor'));

    await waitFor(() => {
      expect(screen.getByTestId('labor-grid')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const VarianceReportsPage = (await import('@/app/accounting/variance-reports/page')).default;

    render(<VarianceReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });
});
