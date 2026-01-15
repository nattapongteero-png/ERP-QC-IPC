/**
 * Quality Deviations Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import DeviationsPage from '@/app/quality/deviations/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { QUALITY_FETCH_HANDLERS, MOCK_QUALITY_DEVIATIONS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  Clock: () => <span data-testid="icon-clock" />,
  AlertOctagon: () => <span data-testid="icon-alert-octagon" />,
  CheckCircle2: () => <span data-testid="icon-check" />,
  FileWarning: () => <span data-testid="icon-file-warning" />,
  BarChart3: () => <span data-testid="icon-barchart" />,
  LayoutGrid: () => <span data-testid="icon-grid" />,
  List: () => <span data-testid="icon-list" />,
  Search: () => <span data-testid="icon-search" />,
  Factory: () => <span data-testid="icon-factory" />,
  Package: () => <span data-testid="icon-package" />,
  Microscope: () => <span data-testid="icon-microscope" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Calendar: () => <span data-testid="icon-calendar" />,
}));

// Mock DevExtreme PieChart
vi.mock('devextreme-react/pie-chart', () => ({
  default: () => <div data-testid="dx-pie-chart" />,
  Series: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Label: () => null,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: { children?: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div data-testid="card" className={className} onClick={onClick}>{children}</div>
  ),
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h3 data-testid="card-title">{children}</h3>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children }: { children?: React.ReactNode }) => <div data-testid="dx-data-grid">{children}</div>,
  DxDataGridColumn: () => null,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick} data-testid={`dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'unnamed'}`}>{text}</button>
  ),
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: () => <input data-testid="dx-text-box" />,
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: () => <select data-testid="dx-select-box" />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: number | string }) => (
    <div data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe('DeviationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByText('ความเบี่ยงเบน')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByText(/CAPA/)).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });

    it('should render Report Deviation button', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-รายงานความเบี่ยงเบน')).toBeInTheDocument();
      });
    });
  });

  describe('KPI StatCards', () => {
    it('should render Total Deviations stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ความเบี่ยงเบนทั้งหมด')).toBeInTheDocument();
      });
    });

    it('should render Active stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-กำลังดำเนินการ')).toBeInTheDocument();
      });
    });

    it('should render Investigating stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-กำลังสอบสวน')).toBeInTheDocument();
      });
    });

    it('should render Critical stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-วิกฤต')).toBeInTheDocument();
      });
    });

    it('should render Overdue stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-เกินกำหนด')).toBeInTheDocument();
      });
    });

    it('should render Resolution Rate stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-อัตราแก้ไข')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch deviations on mount', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const deviationsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/quality/deviations')
      );
      expect(deviationsCall).toBeDefined();
    });

    it('should handle empty deviations gracefully', async () => {
      setupFetchMock({
        '/api/quality/deviations': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByText('ความเบี่ยงเบน')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/quality/deviations': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<DeviationsPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('ความเบี่ยงเบน')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const deviationsResponse = createPaginatedResponse(MOCK_QUALITY_DEVIATIONS);

      // Paginated responses have items array
      expect(deviationsResponse.data.items).toBeDefined();
      expect(deviationsResponse.data.items.length).toBe(MOCK_QUALITY_DEVIATIONS.length);
    });
  });

  describe('View Mode Toggle', () => {
    it('should render view mode toggle buttons', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<DeviationsPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Grid View')).toBeInTheDocument();
        expect(screen.getByTitle('Cards View')).toBeInTheDocument();
        expect(screen.getByTitle('Analytics View')).toBeInTheDocument();
      });
    });
  });
});
