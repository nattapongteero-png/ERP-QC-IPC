/**
 * Test: AP Aging Report Page
 * Feature: 010-accounting-module-integration
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import APAgingReportPage from '@/app/accounting/ap/aging/page';
import type { AgingReport } from '@/types/accounting';

// Mock DevExtreme components
vi.mock('devextreme-react/date-box', () => ({
  DateBox: ({ value, onValueChanged, 'data-testid': testId }: any) => (
    <input
      type="date"
      data-testid={testId}
      value={value ? value.toISOString().split('T')[0] : ''}
      onChange={(e) => onValueChanged?.({ value: new Date(e.target.value) })}
    />
  ),
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, 'data-testid': testId }: any) => (
    <button data-testid={testId} onClick={onClick}>
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/data-grid', () => ({
  __esModule: true,
  default: ({ dataSource, children, 'data-testid': testId }: any) => (
    <div data-testid={testId || 'data-grid'}>
      {dataSource && dataSource.length > 0 && (
        <table>
          <tbody>
            {dataSource.map((row: any, idx: number) => (
              <tr key={idx} data-testid={`grid-row-${idx}`}>
                <td>{row.entityName}</td>
                <td>{row.current}</td>
                <td>{row.days1to30}</td>
                <td>{row.days31to60}</td>
                <td>{row.days61to90}</td>
                <td>{row.over90}</td>
                <td>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {children}
    </div>
  ),
  Column: () => null,
  Export: () => null,
  Summary: () => null,
  TotalItem: () => null,
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock fetch
global.fetch = vi.fn();

const mockAgingReport: AgingReport = {
  reportType: 'AP',
  asOfDate: '2025-01-15',
  entries: [
    {
      entityId: 1,
      entityName: 'ABC Supply Co., Ltd.',
      current: 50000,
      days1to30: 30000,
      days31to60: 20000,
      days61to90: 10000,
      over90: 5000,
      total: 115000,
    },
    {
      entityId: 2,
      entityName: 'XYZ Trading',
      current: 25000,
      days1to30: 15000,
      days31to60: 10000,
      days61to90: 5000,
      over90: 2500,
      total: 57500,
    },
  ],
  buckets: [
    { range: 'Current', count: 2, amount: 75000 },
    { range: '1-30 Days', count: 2, amount: 45000 },
    { range: '31-60 Days', count: 2, amount: 30000 },
    { range: '61-90 Days', count: 2, amount: 15000 },
    { range: '90+ Days', count: 2, amount: 7500 },
  ],
  totals: {
    current: 75000,
    days1to30: 45000,
    days31to60: 30000,
    days61to90: 15000,
    over90: 7500,
    total: 172500,
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('AP Aging Report Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header with correct title and icon', () => {
    render(<APAgingReportPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Aging Report')).toBeInTheDocument();
    expect(screen.getByText('Manage supplier bills and payments')).toBeInTheDocument();
  });

  it('renders filter panel with as-of date selector', () => {
    render(<APAgingReportPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('as-of-date')).toBeInTheDocument();
    expect(screen.getByTestId('generate-report-btn')).toBeInTheDocument();
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  it('shows "no report" message before generating report', () => {
    render(<APAgingReportPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('no-report-message')).toBeInTheDocument();
    expect(screen.getByText('No Report Generated')).toBeInTheDocument();
    expect(screen.getByText('Select an as-of date and click Generate Report to view data.')).toBeInTheDocument();
  });

  it('fetches and displays aging report with KPIs and chart', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockAgingReport }),
    } as Response);

    render(<APAgingReportPage />, { wrapper: createWrapper() });

    // Click generate button
    const generateBtn = screen.getByTestId('generate-report-btn');
    generateBtn.click();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/reports/aging?type=AP&asOfDate=')
      );
    });

    // Check KPI cards
    await waitFor(() => {
      expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('1-30 Days')).toBeInTheDocument();
      expect(screen.getByText('31-60 Days')).toBeInTheDocument();
      expect(screen.getByText('61-90 Days')).toBeInTheDocument();
      expect(screen.getByText('90+ Days')).toBeInTheDocument();
    });

    // Check chart is rendered
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

    // Check grid displays vendor data
    expect(screen.getByTestId('aging-report-grid')).toBeInTheDocument();
    expect(screen.getByText('ABC Supply Co., Ltd.')).toBeInTheDocument();
    expect(screen.getByText('XYZ Trading')).toBeInTheDocument();
  });

  it('displays detailed aging grid with vendor breakdowns', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockAgingReport }),
    } as Response);

    render(<APAgingReportPage />, { wrapper: createWrapper() });

    const generateBtn = screen.getByTestId('generate-report-btn');
    generateBtn.click();

    await waitFor(() => {
      const grid = screen.getByTestId('aging-report-grid');
      expect(within(grid).getByText('AP Aging by Vendor')).toBeInTheDocument();
      expect(within(grid).getByText(`As of ${mockAgingReport.asOfDate}`)).toBeInTheDocument();
      expect(within(grid).getByText('ABC Supply Co., Ltd.')).toBeInTheDocument();
      expect(within(grid).getByText('XYZ Trading')).toBeInTheDocument();
    });
  });

  it('displays error message when API call fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to generate aging report' }),
    } as Response);

    render(<APAgingReportPage />, { wrapper: createWrapper() });

    const generateBtn = screen.getByTestId('generate-report-btn');
    generateBtn.click();

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText(/Failed to generate aging report/i)).toBeInTheDocument();
    });
  });
});
