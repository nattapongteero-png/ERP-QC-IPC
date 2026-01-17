/**
 * Quality Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import QualityDashboardPage from '@/app/quality/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { QUALITY_FETCH_HANDLERS, MOCK_QUALITY_TESTS, MOCK_QUALITY_SPECS, MOCK_QUALITY_DEVIATIONS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ClipboardCheck: () => <span data-testid="icon-clipboard-check" />,
  FlaskConical: () => <span data-testid="icon-flask" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  Clock: () => <span data-testid="icon-clock" />,
  XCircle: () => <span data-testid="icon-xcircle" />,
  List: () => <span data-testid="icon-list" />,
  Grid3X3: () => <span data-testid="icon-grid" />,
  PieChart: () => <span data-testid="icon-pie" />,
  Filter: () => <span data-testid="icon-filter" />,
  FileText: () => <span data-testid="icon-filetext" />,
  Activity: () => <span data-testid="icon-activity" />,
  ArrowRight: () => <span data-testid="icon-arrow" />,
  Beaker: () => <span data-testid="icon-beaker" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Package: () => <span data-testid="icon-package" />,
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="dx-data-grid">{children}</div>,
  Column: () => null,
  SearchPanel: () => null,
  HeaderFilter: () => null,
  FilterRow: () => null,
  Paging: () => null,
  Pager: () => null,
  Scrolling: () => null,
  Toolbar: () => null,
  Item: () => null,
  Grouping: () => null,
  GroupPanel: () => null,
  ColumnChooser: () => null,
  StateStoring: () => null,
  Export: () => null,
}));

vi.mock('devextreme-react/pie-chart', () => ({
  default: () => <div data-testid="dx-pie-chart" />,
  Series: () => null,
  Label: () => null,
  Connector: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Size: () => null,
}));

vi.mock('devextreme-react/select-box', () => ({
  default: () => <select data-testid="dx-select-box" />,
}));

vi.mock('devextreme-react/text-box', () => ({
  default: () => <input data-testid="dx-text-box" />,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick} data-testid={`dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'unnamed'}`}>{text}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: number | string }) => (
    <div data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe('QualityDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('ควบคุมคุณภาพ')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Quality Control Dashboard')).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });
  });

  describe('KPI StatCards', () => {
    it('should render Total Tests stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-การทดสอบทั้งหมด')).toBeInTheDocument();
      });
    });

    it('should render Pending stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-รอทดสอบ')).toBeInTheDocument();
      });
    });

    it('should render Passed stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ผ่านการทดสอบ')).toBeInTheDocument();
      });
    });

    it('should render Failed stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ไม่ผ่านการทดสอบ')).toBeInTheDocument();
      });
    });

    it('should render Specs stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ข้อกำหนดคุณภาพ')).toBeInTheDocument();
      });
    });

    it('should render Open Deviations stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ความเบี่ยงเบนเปิด')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch quality tests on mount', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const testsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/quality/tests')
      );
      expect(testsCall).toBeDefined();
    });

    it('should fetch quality specs on mount', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const specsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/quality/specs')
      );
      expect(specsCall).toBeDefined();
    });

    it('should fetch deviations on mount', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const deviationsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/quality/deviations')
      );
      expect(deviationsCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/quality/tests': { data: createPaginatedResponse([]) },
        '/api/quality/specs': { data: createPaginatedResponse([]) },
        '/api/quality/deviations': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('ควบคุมคุณภาพ')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/quality/tests': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/quality/specs': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/quality/deviations': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<QualityDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('ควบคุมคุณภาพ')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const testsResponse = createPaginatedResponse(MOCK_QUALITY_TESTS);
      const specsResponse = createPaginatedResponse(MOCK_QUALITY_SPECS);
      const deviationsResponse = createPaginatedResponse(MOCK_QUALITY_DEVIATIONS);

      // Paginated responses have items array
      expect(testsResponse.data.items).toBeDefined();
      expect(specsResponse.data.items).toBeDefined();
      expect(deviationsResponse.data.items).toBeDefined();
      expect(testsResponse.data.items.length).toBe(MOCK_QUALITY_TESTS.length);
    });
  });

  describe('View Mode Toggle', () => {
    it('should render view mode toggle buttons', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualityDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTitle('มุมมองตาราง')).toBeInTheDocument();
        expect(screen.getByTitle('มุมมองการ์ด')).toBeInTheDocument();
        expect(screen.getByTitle('มุมมองวิเคราะห์')).toBeInTheDocument();
      });
    });
  });
});
