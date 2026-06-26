/**
 * Production Analytics Page Tests
 *
 * Smoke test: the page renders without runtime errors with realistic
 * work-order data, and the long-label charts (rotated bar charts) mount.
 * Guards the DevExtreme chart label-truncation fix (placeholderSize /
 * textOverflow / stagger) against regressions that throw at render time.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ProductionAnalyticsPage from '@/app/production/analytics/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import { PRODUCTION_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock DevExtreme PieChart (named import PieChart)
vi.mock('devextreme-react/pie-chart', () => {
  const MockPieChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>;
  return {
    __esModule: true,
    default: MockPieChart,
    PieChart: MockPieChart,
    Series: () => null,
    Label: () => null,
    Legend: () => null,
    Tooltip: () => null,
    Connector: () => null,
  };
});

// Mock DevExtreme Chart (named import Chart). The mock renders all nested
// config children so prop typos surface as render errors, but real props
// (placeholderSize, textOverflow, displayMode) are validated by tsc.
vi.mock('devextreme-react/chart', () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>;
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    __esModule: true,
    default: MockChart,
    Chart: MockChart,
    CommonSeriesSettings: () => null,
    Series: () => null,
    ArgumentAxis: Pass,
    ValueAxis: () => null,
    Legend: () => null,
    Tooltip: () => null,
    Label: () => null,
  };
});

describe('ProductionAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('renders the page title without crashing', async () => {
    setupFetchMock(PRODUCTION_FETCH_HANDLERS);

    renderWithProviders(<ProductionAnalyticsPage />);

    // ResponsivePageHeader title comes from translations; the breadcrumb
    // "การผลิต" anchor is always present even before data loads.
    await waitFor(() => {
      expect(screen.getAllByText(/การผลิต/).length).toBeGreaterThan(0);
    });
  });

  it('mounts the charts once work-order data resolves', async () => {
    setupFetchMock(PRODUCTION_FETCH_HANDLERS);

    renderWithProviders(<ProductionAnalyticsPage />);

    // The mock data contains a completed WO with yieldPercentage > 0, so the
    // rotated yield/production/lead-time charts must render — exercising the
    // ArgumentAxis label props from the truncation fix.
    await waitFor(() => {
      expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
  });
});
