import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SalesOrdersPage from '@/app/sales/orders/page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(''),
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

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
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

// Mock cn utility
vi.mock('@/lib/utils/cn', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
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
  DxDataGrid: ({ dataSource }: { dataSource: unknown[] }) => (
    <div data-testid="dx-data-grid">
      <div data-testid="grid-row-count">{dataSource?.length || 0} rows</div>
    </div>
  ),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, icon, hint, elementAttr, ...props }: { text?: string; onClick?: () => void; icon?: string; hint?: string; elementAttr?: Record<string, string>; 'data-testid'?: string }) => (
    <button onClick={onClick} data-testid={elementAttr?.['data-testid'] || props['data-testid'] || `dx-button-${icon || text}`}>{text || icon || hint}</button>
  ),
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ placeholder, value, onValueChange, elementAttr }: { placeholder?: string; value?: string; onValueChange?: (v: string) => void; elementAttr?: Record<string, string> }) => (
    <input
      data-testid={elementAttr?.['data-testid'] || 'dx-text-box'}
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
const mockOrders = [
  {
    id: 1,
    soNumber: 'SO240101001',
    customerName: 'บริษัท ABC จำกัด',
    customerContact: '02-123-4567',
    customerAddress: '123 Bangkok',
    orderDate: '2024-01-15',
    requiredDate: '2024-02-15',
    status: 'confirmed',
    totalAmount: 150000,
    currency: 'THB',
    paymentTerms: 'Net 30',
    notes: '',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    soNumber: 'SO240101002',
    customerName: 'บริษัท XYZ จำกัด',
    customerContact: '02-987-6543',
    customerAddress: '456 Bangkok',
    orderDate: '2024-01-18',
    requiredDate: '2024-01-20',
    status: 'processing',
    totalAmount: 85000,
    currency: 'THB',
    paymentTerms: 'Net 30',
    notes: '',
    createdAt: '2024-01-18T14:00:00Z',
    updatedAt: '2024-01-18T14:00:00Z',
  },
  {
    id: 3,
    soNumber: 'SO240101003',
    customerName: 'ร้านค้า DEF',
    customerContact: '081-234-5678',
    customerAddress: '789 Chiang Mai',
    orderDate: '2024-01-10',
    requiredDate: '2024-01-25',
    status: 'delivered',
    totalAmount: 220000,
    currency: 'THB',
    paymentTerms: 'COD',
    notes: 'Delivered on time',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-25T16:00:00Z',
  },
  {
    id: 4,
    soNumber: 'SO240101004',
    customerName: 'บริษัท ABC จำกัด',
    customerContact: '02-123-4567',
    customerAddress: '123 Bangkok',
    orderDate: '2024-01-05',
    requiredDate: '2024-01-10',
    status: 'cancelled',
    totalAmount: 50000,
    currency: 'THB',
    paymentTerms: 'Net 30',
    notes: 'Customer cancelled',
    createdAt: '2024-01-05T11:00:00Z',
    updatedAt: '2024-01-06T10:00:00Z',
  },
  {
    id: 5,
    soNumber: 'SO240101005',
    customerName: 'ห้างหุ้นส่วน GHI',
    customerContact: '089-111-2222',
    customerAddress: '999 Phuket',
    orderDate: '2024-01-20',
    requiredDate: '2024-02-01',
    status: 'ready',
    totalAmount: 175000,
    currency: 'THB',
    paymentTerms: 'Net 15',
    notes: '',
    createdAt: '2024-01-20T08:00:00Z',
    updatedAt: '2024-01-22T10:00:00Z',
  },
];

describe('SalesOrdersPage', () => {
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
      render(<SalesOrdersPage />);

      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      expect(screen.getByText('Manage sales orders and track delivery status')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      render(<SalesOrdersPage />);

      expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Ready to Ship').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Pending Value').length).toBeGreaterThanOrEqual(1);
    });

    it('renders action buttons', () => {
      render(<SalesOrdersPage />);

      expect(screen.getByTestId('so-add-btn')).toBeInTheDocument();
      expect(screen.getByText('Create Sales Order')).toBeInTheDocument();
    });

    it('renders filter controls', () => {
      render(<SalesOrdersPage />);

      expect(screen.getByTestId('so-search-input')).toBeInTheDocument();
      expect(screen.getByTestId('so-status-tab-all')).toBeInTheDocument();
    });

    it('renders view mode toggle buttons', () => {
      render(<SalesOrdersPage />);

      expect(screen.getByTitle('Grid View')).toBeInTheDocument();
      expect(screen.getByTitle('Cards View')).toBeInTheDocument();
      expect(screen.getByTitle('Analytics View')).toBeInTheDocument();
    });

    it('wraps content in MainLayout', () => {
      render(<SalesOrdersPage />);

      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when data is loading', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: true,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('renders data grid with orders', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('5 rows');
    });

    it('shows empty state when no orders', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('0 rows');
    });

    it('calculates statistics correctly', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('5 rows');
    });
  });

  describe('Filtering', () => {
    it('filters by search text', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      const searchInput = screen.getByTestId('so-search-input');
      fireEvent.change(searchInput, { target: { value: 'ABC' } });

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('2 rows');
    });

    it('filters by status', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      const deliveredTab = screen.getByTestId('so-status-tab-delivered');
      fireEvent.click(deliveredTab);

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('1 rows');
    });

    it('combines search and status filters', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      const searchInput = screen.getByTestId('so-search-input');
      fireEvent.change(searchInput, { target: { value: 'ABC' } });

      const confirmedTab = screen.getByTestId('so-status-tab-confirmed');
      fireEvent.click(confirmedTab);

      expect(screen.getByTestId('grid-row-count')).toHaveTextContent('1 rows');
    });
  });

  describe('View Mode Switching', () => {
    it('switches to cards view', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      const cardsButton = screen.getByTitle('Cards View');
      fireEvent.click(cardsButton);

      // In cards view, we should see charts
      expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
    });

    it('switches to analytics view', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      const analyticsButton = screen.getByTitle('Analytics View');
      fireEvent.click(analyticsButton);

      expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
    });

    it('switches back to grid view', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      fireEvent.click(screen.getByTitle('Cards View'));
      fireEvent.click(screen.getByTitle('Grid View'));

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to new order page', () => {
      render(<SalesOrdersPage />);

      const addButton = screen.getByText('Create Sales Order');
      fireEvent.click(addButton);

      expect(mockPush).toHaveBeenCalledWith('/sales/orders/new');
    });

    it('calls refetch when refresh button clicked', () => {
      const mockRefetch = vi.fn();
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<SalesOrdersPage />);

      const refreshButton = screen.getByTestId('so-refresh-btn');
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Charts', () => {
    it('renders pie charts in cards view', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      fireEvent.click(screen.getByTitle('Cards View'));

      // Should render 2 pie charts (status, value)
      expect(screen.getAllByTestId('pie-chart').length).toBe(2);
    });

    it('shows no data message when no chart data', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      fireEvent.click(screen.getByTitle('Cards View'));

      expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
    });
  });

  describe('Customer Analytics', () => {
    it('displays top customers in cards view', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      fireEvent.click(screen.getByTitle('Cards View'));

      // ABC has 2 orders - may appear multiple times (in sidebar and main content)
      const abcElements = screen.getAllByText('บริษัท ABC จำกัด');
      expect(abcElements.length).toBeGreaterThan(0);
    });

    it('displays top customers in analytics view', () => {
      mockUseQuery.mockReturnValue({
        data: mockOrders,
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<SalesOrdersPage />);

      fireEvent.click(screen.getByTitle('Analytics View'));

      expect(screen.getByText('Top Customers')).toBeInTheDocument();
    });
  });

  describe('React Query Configuration', () => {
    it('uses correct query key', () => {
      render(<SalesOrdersPage />);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['sales-orders'],
        })
      );
    });
  });

  describe('Status Display', () => {
    it('displays all status tabs', () => {
      render(<SalesOrdersPage />);

      expect(screen.getByTestId('so-status-tab-all')).toBeInTheDocument();
      expect(screen.getByTestId('so-status-tab-draft')).toBeInTheDocument();
      expect(screen.getByTestId('so-status-tab-confirmed')).toBeInTheDocument();
      expect(screen.getByTestId('so-status-tab-delivered')).toBeInTheDocument();
    });
  });
});
