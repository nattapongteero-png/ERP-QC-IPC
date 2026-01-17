/**
 * Quality Specs Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import QualitySpecsPage from '@/app/quality/specs/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { QUALITY_FETCH_HANDLERS, MOCK_QUALITY_SPECS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileCheck: () => <span data-testid="icon-file-check" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-xcircle" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Shield: () => <span data-testid="icon-shield" />,
  Package: () => <span data-testid="icon-package" />,
  Eye: () => <span data-testid="icon-eye" />,
  LayoutGrid: () => <span data-testid="icon-grid" />,
  LayoutList: () => <span data-testid="icon-list" />,
  BarChart3: () => <span data-testid="icon-barchart" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Beaker: () => <span data-testid="icon-beaker" />,
  ListChecks: () => <span data-testid="icon-listchecks" />,
  Filter: () => <span data-testid="icon-filter" />,
  Plus: () => <span data-testid="icon-plus" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
}));

// Mock DevExtreme DataGrid
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="dx-data-grid">{children}</div>,
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  SearchPanel: () => null,
  HeaderFilter: () => null,
  Scrolling: () => null,
  Export: () => null,
}));

// Mock DevExtreme PieChart
vi.mock('devextreme-react/pie-chart', () => ({
  PieChart: () => <div data-testid="dx-pie-chart" />,
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));

// Mock DevExtreme SelectBox and TextBox
vi.mock('devextreme-react/select-box', () => ({
  SelectBox: () => <select data-testid="dx-select-box" />,
}));

vi.mock('devextreme-react/text-box', () => ({
  TextBox: () => <input data-testid="dx-text-box" />,
}));

// Mock other dependencies
vi.mock('exceljs', () => ({
  Workbook: vi.fn(() => ({
    addWorksheet: vi.fn(() => ({})),
    xlsx: { writeBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))) },
  })),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('devextreme/excel_exporter', () => ({
  exportDataGrid: vi.fn(() => Promise.resolve()),
}));

// Mock UI components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, icon }: { text?: string; onClick?: () => void; icon?: string }) => (
    <button onClick={onClick} data-testid={`dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || icon || 'unnamed'}`}>{text}</button>
  ),
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

describe('QualitySpecsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByText('Quality Specifications')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByText(/ข้อกำหนดคุณภาพ/)).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });

    it('should render New Spec button', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-new-spec')).toBeInTheDocument();
      });
    });
  });

  describe('KPI StatCards', () => {
    it('should render Total Specs stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ข้อกำหนดทั้งหมด')).toBeInTheDocument();
      });
    });

    it('should render Active stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ใช้งาน')).toBeInTheDocument();
      });
    });

    it('should render Critical stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-critical')).toBeInTheDocument();
      });
    });

    it('should render Non-Critical stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-non-critical')).toBeInTheDocument();
      });
    });

    it('should render Inactive stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-ไม่ใช้งาน')).toBeInTheDocument();
      });
    });

    it('should render Items With Specs stat card', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('stat-สินค้าที่มี-spec')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch specs on mount', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const specsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/quality/specs')
      );
      expect(specsCall).toBeDefined();
    });

    it('should handle empty specs gracefully', async () => {
      setupFetchMock({
        '/api/quality/specs': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByText('Quality Specifications')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/quality/specs': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<QualitySpecsPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Quality Specifications')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const specsResponse = createPaginatedResponse(MOCK_QUALITY_SPECS);

      // Paginated responses have items array
      expect(specsResponse.data.items).toBeDefined();
      expect(specsResponse.data.items.length).toBe(MOCK_QUALITY_SPECS.length);
    });
  });

  describe('View Mode Toggle', () => {
    it('should render Grid view mode button', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByText('Grid')).toBeInTheDocument();
      });
    });

    it('should render Cards view mode button', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByText('Cards')).toBeInTheDocument();
      });
    });

    it('should render Analytics view mode button', async () => {
      setupFetchMock(QUALITY_FETCH_HANDLERS);

      renderWithProviders(<QualitySpecsPage />);

      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });
    });
  });
});
