import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviationsPage from '@/app/quality/deviations/page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/pie-chart', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Series: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Label: () => null,
}));

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div data-testid="page-header-actions">{actions}</div>
    </div>
  ),
  StatCard: ({ label, value, isLoading }: { label: string; value: number | string; isLoading?: boolean }) => (
    <div data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <span>{isLoading ? 'Loading...' : value}</span>
    </div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div data-testid="card" className={className} onClick={onClick}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="card-title">{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ dataSource, columns, onRowClick }: { dataSource: unknown[]; columns: unknown[]; onRowClick?: (e: { data: unknown }) => void }) => (
    <div data-testid="dx-data-grid">
      <div data-testid="grid-row-count">{dataSource?.length || 0} rows</div>
    </div>
  ),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, icon, hint, ...props }: { text?: string; onClick?: () => void; icon?: string; hint?: string; 'data-testid'?: string }) => (
    <button onClick={onClick} data-testid={props['data-testid'] || `dx-button-${icon || text}`}>{text || icon || hint}</button>
  ),
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ placeholder, value, onValueChange }: { placeholder?: string; value?: string; onValueChange?: (v: string) => void }) => (
    <input
      data-testid="dx-text-box"
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ items, value, onValueChange, placeholder }: { items: { value: string; label: string }[]; value?: string; onValueChange?: (v: string) => void; placeholder?: string }) => (
    <select
      data-testid={`dx-select-box-${placeholder?.toLowerCase().replace(/\s+/g, '-') || 'select'}`}
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {items?.map((item) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid={`badge-${variant || 'default'}`}>{children}</span>
  ),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

// Import useQuery after mock setup
import { useQuery } from '@tanstack/react-query';
const mockUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;

// Sample test data
const mockDeviations = [
  {
    id: 1,
    deviationNumber: 'DEV2401001',
    title: 'Temperature Excursion',
    description: 'Storage temperature exceeded limits',
    sourceType: 'warehouse',
    sourceId: 1,
    severity: 'major',
    status: 'open',
    rootCause: null,
    correctiveAction: null,
    preventiveAction: null,
    reportedBy: 1,
    assignedTo: 2,
    dueDate: '2024-02-15',
    closedBy: null,
    closedAt: null,
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 2,
    deviationNumber: 'DEV2401002',
    title: 'Equipment Malfunction',
    description: 'Mixer blade damaged during operation',
    sourceType: 'production',
    sourceId: 1,
    severity: 'critical',
    status: 'investigating',
    rootCause: 'Worn bearings',
    correctiveAction: null,
    preventiveAction: null,
    reportedBy: 1,
    assignedTo: 3,
    dueDate: '2024-01-25',
    closedBy: null,
    closedAt: null,
    createdAt: '2024-01-18T14:00:00Z',
    updatedAt: '2024-01-19T09:00:00Z',
  },
  {
    id: 3,
    deviationNumber: 'DEV2401003',
    title: 'Test Result Out of Spec',
    description: 'Moisture content exceeded specification',
    sourceType: 'quality',
    sourceId: 1,
    severity: 'minor',
    status: 'resolved',
    rootCause: 'Improper drying',
    correctiveAction: 'Extended drying time',
    preventiveAction: 'Updated SOP',
    reportedBy: 2,
    assignedTo: 1,
    dueDate: '2024-01-22',
    closedBy: null,
    closedAt: null,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-21T16:00:00Z',
  },
  {
    id: 4,
    deviationNumber: 'DEV2312001',
    title: 'Documentation Error',
    description: 'Batch record had incorrect entries',
    sourceType: 'production',
    sourceId: 2,
    severity: 'minor',
    status: 'closed',
    rootCause: 'Human error',
    correctiveAction: 'Record corrected',
    preventiveAction: 'Training provided',
    reportedBy: 3,
    assignedTo: 2,
    dueDate: '2023-12-20',
    closedBy: 1,
    closedAt: '2023-12-19T10:00:00Z',
    createdAt: '2023-12-10T11:00:00Z',
    updatedAt: '2023-12-19T10:00:00Z',
  },
];

describe('DeviationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the page header correctly', () => {
      render(<DeviationsPage />);

      expect(screen.getByText('ความเบี่ยงเบน')).toBeInTheDocument();
      expect(screen.getByText('ติดตามและจัดการความเบี่ยงเบนและ CAPA')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      render(<DeviationsPage />);

      expect(screen.getByTestId('stat-card-ความเบี่ยงเบนทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-กำลังดำเนินการ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-กำลังสอบสวน')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-วิกฤต')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-เกินกำหนด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-อัตราแก้ไข')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<DeviationsPage />);

      expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
      expect(screen.getByText('รายงานความเบี่ยงเบน')).toBeInTheDocument();
    });

    it('renders filter controls', () => {
      render(<DeviationsPage />);

      expect(screen.getByTestId('dx-text-box')).toBeInTheDocument();
      expect(screen.getByTestId('dx-select-box-สถานะ')).toBeInTheDocument();
      expect(screen.getByTestId('dx-select-box-ระดับ')).toBeInTheDocument();
      expect(screen.getByTestId('dx-select-box-แหล่งที่มา')).toBeInTheDocument();
    });

    it('renders view mode toggle buttons', () => {
      render(<DeviationsPage />);

      // Check for view toggle buttons (hidden on mobile, visible on md+)
      expect(screen.getByTitle('Grid View')).toBeInTheDocument();
      expect(screen.getByTitle('Cards View')).toBeInTheDocument();
      expect(screen.getByTitle('Analytics View')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when data is loading', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: true,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      // StatCards should show loading (multiple loading indicators)
      const loadingElements = screen.getAllByText('Loading...');
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Data Display', () => {
    it('renders data grid with deviations', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('4 rows');
    });

    it('shows empty state when no deviations', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('ไม่พบความเบี่ยงเบน')).toBeInTheDocument();
    });

    it('calculates statistics correctly', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      // Check stat values
      // total: 4, open: 1, investigating: 1, resolved: 1, closed: 1
      // critical (not closed): 1, activeTotal: 2, resolutionRate: 50%
      const totalCard = screen.getByTestId('stat-card-ความเบี่ยงเบนทั้งหมด');
      expect(totalCard).toHaveTextContent('4');
    });
  });

  describe('Filtering', () => {
    it('filters by search text', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const searchInput = screen.getByTestId('dx-text-box');
      fireEvent.change(searchInput, { target: { value: 'Temperature' } });

      // Should filter to show only matching deviations
      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('1 rows');
    });

    it('filters by status', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const statusSelect = screen.getByTestId('dx-select-box-สถานะ');
      fireEvent.change(statusSelect, { target: { value: 'open' } });

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('1 rows');
    });

    it('filters by severity', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const severitySelect = screen.getByTestId('dx-select-box-ระดับ');
      fireEvent.change(severitySelect, { target: { value: 'critical' } });

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('1 rows');
    });

    it('filters by source type', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const sourceSelect = screen.getByTestId('dx-select-box-แหล่งที่มา');
      fireEvent.change(sourceSelect, { target: { value: 'production' } });

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('2 rows');
    });

    it('combines multiple filters', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const severitySelect = screen.getByTestId('dx-select-box-ระดับ');
      fireEvent.change(severitySelect, { target: { value: 'minor' } });

      const statusSelect = screen.getByTestId('dx-select-box-สถานะ');
      fireEvent.change(statusSelect, { target: { value: 'closed' } });

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('1 rows');
    });
  });

  describe('View Mode Switching', () => {
    it('switches to cards view', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const cardsButton = screen.getByTitle('Cards View');
      fireEvent.click(cardsButton);

      // In cards view, we should see charts
      expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
    });

    it('switches to analytics view', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      const analyticsButton = screen.getByTitle('Analytics View');
      fireEvent.click(analyticsButton);

      // Should show analytics content with charts
      expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
    });

    it('switches back to grid view', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      // Switch to cards first
      fireEvent.click(screen.getByTitle('Cards View'));
      // Then back to grid
      fireEvent.click(screen.getByTitle('Grid View'));

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to new deviation page', () => {
      render(<DeviationsPage />);

      const addButton = screen.getByText('รายงานความเบี่ยงเบน');
      fireEvent.click(addButton);

      expect(mockPush).toHaveBeenCalledWith('/quality/deviations/new');
    });

    it('calls refetch when refresh button clicked', () => {
      const mockRefetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<DeviationsPage />);

      const refreshButton = screen.getByTestId('dx-button-refresh');
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Critical Alert', () => {
    it('shows critical alert when there are critical deviations', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      // Should show alert because there's 1 critical deviation that's not closed
      expect(screen.getByText(/ความเบี่ยงเบนวิกฤตต้องการการดำเนินการ/)).toBeInTheDocument();
    });

    it('does not show critical alert when no critical deviations', () => {
      const nonCriticalDeviations = mockDeviations.filter(d => d.severity !== 'critical');
      mockUseQuery.mockReturnValue({
        data: nonCriticalDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      expect(screen.queryByText(/ความเบี่ยงเบนวิกฤตต้องการการดำเนินการ/)).not.toBeInTheDocument();
    });
  });

  describe('Charts', () => {
    it('renders pie charts in cards view', () => {
      mockUseQuery.mockReturnValue({
        data: mockDeviations,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      // Switch to cards view
      fireEvent.click(screen.getByTitle('Cards View'));

      // Should render 3 pie charts (status, severity, source)
      expect(screen.getAllByTestId('pie-chart').length).toBe(3);
    });

    it('shows no data message when no chart data', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<DeviationsPage />);

      // Switch to cards view
      fireEvent.click(screen.getByTitle('Cards View'));

      // Should show "ไม่มีข้อมูล" messages
      expect(screen.getAllByText('ไม่มีข้อมูล').length).toBeGreaterThan(0);
    });
  });

  describe('React Query Configuration', () => {
    it('uses correct query key', () => {
      render(<DeviationsPage />);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['quality-deviations'],
        })
      );
    });
  });
});
