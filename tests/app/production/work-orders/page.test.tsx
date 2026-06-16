/**
 * Work Orders Page - Edit/Delete Functionality Tests
 *
 * Verifies that:
 * 1. Page renders without crashing
 * 2. Edit/Delete buttons appear for planned WOs
 * 3. Edit/Delete buttons do NOT appear for in_progress WOs
 * 4. Edit/Delete buttons do NOT appear for completed WOs
 * 5. View button appears for ALL WOs
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// Mock next-intl — return the key so testids/text stay deterministic
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock hooks that touch browser-only APIs (useMobile/matchMedia, EventSource)
vi.mock('@/hooks/use-mobile', () => ({
  useMobile: () => ({ isMobile: false }),
}));
vi.mock('@/hooks/use-realtime-topic', () => ({
  useRealtimeTopic: vi.fn(),
}));

// Mock shared layout/UI primitives used in render
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, actions }: any) => (
    <div data-testid="page-header">{title}{actions}</div>
  ),
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">{label}: {value}</div>
  ),
}));
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ visible, children }: any) => (visible ? <div data-testid="popup">{children}</div> : null),
  DxConfirmDialog: ({ visible, children }: any) => (visible ? <div data-testid="confirm-dialog">{children}</div> : null),
}));
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: any) => <button onClick={onClick}>{text}</button>,
}));
vi.mock('@/components/ui/dx-tabs', () => ({
  DxTabs: () => <div data-testid="tabs" />,
}));

// Mock TanStack Query with test data
const mockRefetch = vi.fn();
const mockMutate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [
      {
        id: 1, woNumber: 'WO260301', batchNumber: 'B001', status: 'planned',
        priority: 5, plannedQuantity: 100, actualQuantity: 0, unit: 'kg',
        productName: 'Test Product', productCode: 'P001',
        plannedStartDate: '2026-03-25', plannedEndDate: '2026-03-30',
        yieldPercentage: 0, productId: 1, createdAt: '2026-03-25',
        actualStartDate: '', actualEndDate: '', notes: null,
      },
      {
        id: 2, woNumber: 'WO260302', batchNumber: 'B002', status: 'in_progress',
        priority: 3, plannedQuantity: 200, actualQuantity: 50, unit: 'kg',
        productName: 'Product 2', productCode: 'P002',
        plannedStartDate: '2026-03-20', plannedEndDate: '2026-03-28',
        yieldPercentage: 25, productId: 2, createdAt: '2026-03-20',
        actualStartDate: '2026-03-20', actualEndDate: '', notes: null,
      },
      {
        id: 3, woNumber: 'WO260303', batchNumber: 'B003', status: 'completed',
        priority: 7, plannedQuantity: 300, actualQuantity: 290, unit: 'kg',
        productName: 'Product 3', productCode: 'P003',
        plannedStartDate: '2026-03-10', plannedEndDate: '2026-03-15',
        yieldPercentage: 96.7, productId: 3, createdAt: '2026-03-10',
        actualStartDate: '2026-03-10', actualEndDate: '2026-03-15', notes: 'done',
      },
    ],
    isLoading: false,
    refetch: mockRefetch,
  }),
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({ default: vi.fn() }));

// Mock DevExtreme DataGrid - renders rows with cellRender output
vi.mock('devextreme-react/data-grid', () => {
  const DataGrid = ({ dataSource, children, onRowClick }: any) => (
    <div data-testid="data-grid">
      {Array.isArray(dataSource) && dataSource.map((item: any) => (
        <div
          key={item.id}
          data-testid={`row-${item.id}`}
          onClick={() => onRowClick?.({ data: item, rowType: 'data' })}
        >
          {React.Children.map(children, (child: any) => {
            if (child?.props?.cellRender) {
              return child.props.cellRender({ data: item });
            }
            return null;
          })}
        </div>
      ))}
    </div>
  );
  return {
    default: DataGrid,
    Column: ({ children }: any) => <>{children}</>,
    Paging: () => null,
    Pager: () => null,
    FilterRow: () => null,
    SearchPanel: () => null,
    HeaderFilter: () => null,
    Scrolling: () => null,
    Export: () => null,
  };
});

// Mock DevExtreme chart components
vi.mock('devextreme-react/pie-chart', () => ({
  PieChart: () => null,
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));
vi.mock('devextreme-react/chart', () => ({
  Chart: () => null,
  CommonSeriesSettings: () => null,
  Series: () => null,
  ArgumentAxis: () => null,
  ValueAxis: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Label: () => null,
}));

// Mock other DevExtreme form components
vi.mock('devextreme-react/date-box', () => ({ default: () => null }));
vi.mock('devextreme-react/number-box', () => ({ default: () => null }));
vi.mock('devextreme-react/select-box', () => ({ default: () => null }));
vi.mock('devextreme-react/text-area', () => ({ default: () => null }));
vi.mock('devextreme-react/text-box', () => ({ default: () => null }));
vi.mock('devextreme/excel_exporter', () => ({ exportDataGrid: vi.fn() }));
vi.mock('exceljs', () => ({ Workbook: vi.fn() }));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

import WorkOrdersPage from '@/app/production/work-orders/page';

describe('WorkOrdersPage - Edit/Delete functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Component fetches /api/hr/employees on mount; provide a valid response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [] } }),
    }) as any;
  });

  it('renders without crashing', () => {
    render(<WorkOrdersPage />);
    expect(screen.getByTestId('data-grid')).toBeInTheDocument();
  });

  it('shows edit and delete buttons for planned WOs', () => {
    render(<WorkOrdersPage />);
    // WO id=1 has status 'planned' - should show edit and delete
    expect(screen.getByTestId('edit-wo-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-wo-1')).toBeInTheDocument();
  });

  it('does NOT show edit/delete buttons for in_progress WOs', () => {
    render(<WorkOrdersPage />);
    // WO id=2 has status 'in_progress' - should NOT show edit/delete
    expect(screen.queryByTestId('edit-wo-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-wo-2')).not.toBeInTheDocument();
  });

  it('does NOT show edit/delete buttons for completed WOs', () => {
    render(<WorkOrdersPage />);
    // WO id=3 has status 'completed' - should NOT show edit/delete
    expect(screen.queryByTestId('edit-wo-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-wo-3')).not.toBeInTheDocument();
  });

  it('shows view button for ALL work orders', () => {
    render(<WorkOrdersPage />);
    // View button should appear for every WO regardless of status
    expect(screen.getByTestId('view-wo-1')).toBeInTheDocument();
    expect(screen.getByTestId('view-wo-2')).toBeInTheDocument();
    expect(screen.getByTestId('view-wo-3')).toBeInTheDocument();
  });
});
