import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PeriodClosePage from '@/app/accounting/period-close/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = vi.fn();

// Mock DevExtreme charts
vi.mock('devextreme-react/pie-chart', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));

vi.mock('devextreme-react/circular-gauge', () => ({
  CircularGauge: ({ children }: { children: React.ReactNode }) => <div data-testid="circular-gauge">{children}</div>,
  Scale: () => null,
  RangeContainer: () => null,
  Range: () => null,
  ValueIndicator: () => null,
  Geometry: () => null,
}));

vi.mock('devextreme-react/funnel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="funnel-chart">{children}</div>,
  Item: () => null,
  Label: () => null,
  Tooltip: () => null,
}));

vi.mock('devextreme-react/sparkline', () => ({
  Sparkline: () => <div data-testid="sparkline" />,
  Tooltip: () => null,
}));

vi.mock('devextreme-react/chart', () => ({
  Size: () => null,
  Border: () => null,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
};

describe('PeriodClosePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders page with header and subtitle', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Accounting')).toBeInTheDocument();
    });
    expect(screen.getByText('Month-end and year-end closing procedures')).toBeInTheDocument();
  });

  it('renders KPI cards with period status counts', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Open Periods')).toBeInTheDocument();
    });
    expect(screen.getByText('Soft Closed')).toBeInTheDocument();
    expect(screen.getByText('Closed Periods')).toBeInTheDocument();
    expect(screen.getByText('Close Progress')).toBeInTheDocument();
  });

  it('renders charts section with distribution, gauge, and workflow', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Period Status Distribution')).toBeInTheDocument();
    });
    expect(screen.getByText('Year Close Progress')).toBeInTheDocument();
    expect(screen.getByText('Close Workflow')).toBeInTheDocument();
  });

  it('renders fiscal year filter', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Fiscal Year:')).toBeInTheDocument();
    });
  });

  it('renders data grid for fiscal periods', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            periodName: 'January 2024',
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            status: 'open',
            fiscalYear: { yearCode: '2024' },
          },
        ],
      }),
    } as Response);

    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Fiscal Periods')).toBeInTheDocument();
    });
    expect(screen.getByText('Select a period to view close status and perform actions')).toBeInTheDocument();
  });

  it('shows select period prompt when no period is selected', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Select a Period')).toBeInTheDocument();
    });
    expect(screen.getByText('No Period Selected')).toBeInTheDocument();
    expect(screen.getByText('Click on a period from the list to view close status')).toBeInTheDocument();
  });

  it('renders recently closed section', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Recently Closed')).toBeInTheDocument();
    });
    expect(screen.getByText('Last 5 closed periods')).toBeInTheDocument();
  });

  it('renders period close guide with steps', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Period Close Guide')).toBeInTheDocument();
    });
    expect(screen.getByText('Post All Entries')).toBeInTheDocument();
    expect(screen.getByText('Process Invoices')).toBeInTheDocument();
    expect(screen.getByText('Balance Check')).toBeInTheDocument();
    expect(screen.getByText('Close Period')).toBeInTheDocument();
  });

  it('renders with correct test id', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('period-close-page')).toBeInTheDocument();
    });
  });

  it('shows validation panel with appropriate state', async () => {
    // The validation panel shows "No Period Selected" when no period is clicked
    // Validation metrics only appear after a period row is selected
    vi.mocked(fetch).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('fiscal-years')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: 1, yearCode: '2024', yearName: 'FY 2024', status: 'active' }],
          }),
        } as Response);
      }
      if (typeof url === 'string' && url.includes('fiscal-periods')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                periodName: 'January 2024',
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                status: 'open',
                fiscalYear: { yearCode: '2024' },
              },
            ],
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });

    render(<PeriodClosePage />, { wrapper: createWrapper() });

    // Validation panel should show prompt to select a period initially
    await waitFor(() => {
      expect(screen.getByText('Select a Period')).toBeInTheDocument();
    });
    expect(screen.getByText('No Period Selected')).toBeInTheDocument();
    expect(screen.getByText('Click on a period from the list to view close status')).toBeInTheDocument();
  });
});
