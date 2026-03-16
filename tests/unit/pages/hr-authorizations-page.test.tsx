/**
 * Unit Tests for HR Authorizations Page
 * Tests the redesigned Authorization Management Dashboard with:
 * - Grid view with DataGrid for authorizations
 * - Cards view with authorization cards grouped by type
 * - Analytics view with pie charts and statistics
 * - KPI dashboard statistics
 * - View mode switching
 * - Filter panel functionality
 * - Grant and Delegate popups
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
}));

// Mock authorization data
const mockAuthorizations = [
  {
    id: 1,
    employeeId: 1,
    employeeName: 'สมชาย ใจดี',
    authType: 'batch_release' as const,
    scopeProductLines: ['HRB-001', 'HRB-002'],
    scopeSiteId: 1,
    scopeSiteName: 'โรงงานหลัก',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2024-12-31',
    isActive: true,
    grantedById: 2,
    grantedByName: 'ผู้จัดการ A',
    grantedAt: '2024-01-01',
    revokedAt: null,
    revokedById: null,
    delegations: [],
  },
  {
    id: 2,
    employeeId: 2,
    employeeName: 'สมหญิง รักดี',
    authType: 'sop_approval' as const,
    scopeProductLines: [],
    scopeSiteId: 1,
    scopeSiteName: 'โรงงานหลัก',
    effectiveFrom: '2024-01-15',
    effectiveTo: null,
    isActive: true,
    grantedById: 2,
    grantedByName: 'ผู้จัดการ A',
    grantedAt: '2024-01-15',
    revokedAt: null,
    revokedById: null,
    delegations: [
      {
        id: 1,
        authorizationId: 2,
        delegatedToId: 3,
        delegatedToName: 'สมศักดิ์ มั่นคง',
        delegatedFromDate: '2024-06-01',
        delegatedToDate: '2024-06-15',
        reason: 'ลาพักร้อน',
        isActive: true,
      },
    ],
  },
  {
    id: 3,
    employeeId: 3,
    employeeName: 'สมศักดิ์ มั่นคง',
    authType: 'deviation_approval' as const,
    scopeProductLines: ['HRB-003'],
    scopeSiteId: 1,
    scopeSiteName: 'โรงงานหลัก',
    effectiveFrom: '2023-01-01',
    effectiveTo: '2023-12-31',
    isActive: false,
    grantedById: 2,
    grantedByName: 'ผู้จัดการ A',
    grantedAt: '2023-01-01',
    revokedAt: null,
    revokedById: null,
    delegations: [],
  },
  {
    id: 4,
    employeeId: 4,
    employeeName: 'สมปอง รักงาน',
    authType: 'change_control_approval' as const,
    scopeProductLines: [],
    scopeSiteId: 1,
    scopeSiteName: 'โรงงานหลัก',
    effectiveFrom: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    effectiveTo: null,
    isActive: true,
    grantedById: 2,
    grantedByName: 'ผู้จัดการ A',
    grantedAt: '2024-01-01',
    revokedAt: null,
    revokedById: null,
    delegations: [],
  },
];

// Mock employee data
const mockEmployees = [
  { id: 1, employeeCode: 'EMP001', firstName: 'สมชาย', lastName: 'ใจดี' },
  { id: 2, employeeCode: 'EMP002', firstName: 'สมหญิง', lastName: 'รักดี' },
  { id: 3, employeeCode: 'EMP003', firstName: 'สมศักดิ์', lastName: 'มั่นคง' },
  { id: 4, employeeCode: 'EMP004', firstName: 'สมปอง', lastName: 'รักงาน' },
];

// Mock TanStack Query
const mockMutate = vi.fn();
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('authorizations')) {
      return {
        data: mockAuthorizations,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('employees')) {
      return {
        data: mockEmployees,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return {
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    };
  }),
  useMutation: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: vi.fn(({ dataSource, children, onRowClick }) => (
    <div data-testid="dx-data-grid" data-row-count={dataSource?.length || 0}>
      <table>
        <tbody>
          {dataSource?.map((item: { id: number }, index: number) => (
            <tr
              key={index}
              data-testid={`grid-row-${index}`}
              onClick={() => onRowClick?.({ data: item })}
            >
              <td>{item.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </div>
  )),
  Column: vi.fn(() => null),
  SearchPanel: vi.fn(() => null),
  HeaderFilter: vi.fn(() => null),
  FilterRow: vi.fn(() => null),
  Paging: vi.fn(() => null),
  Pager: vi.fn(() => null),
  Scrolling: vi.fn(() => null),
  Export: vi.fn(() => null),
  Toolbar: vi.fn(() => null),
  Item: vi.fn(() => null),
  Grouping: vi.fn(() => null),
  GroupPanel: vi.fn(() => null),
  ColumnChooser: vi.fn(() => null),
  StateStoring: vi.fn(() => null),
}));

vi.mock('devextreme-react/pie-chart', () => ({
  default: vi.fn(({ dataSource, children }) => (
    <div data-testid="pie-chart" data-count={dataSource?.length || 0}>
      Pie Chart
      {children}
    </div>
  )),
  Series: vi.fn(() => null),
  Label: vi.fn(() => null),
  Connector: vi.fn(() => null),
  Legend: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  Size: vi.fn(() => null),
}));

vi.mock('devextreme-react/popup', () => ({
  Popup: vi.fn(({ visible, children, title }) => (
    visible ? (
      <div data-testid="dx-popup" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
  )),
  ToolbarItem: vi.fn(() => null),
}));

vi.mock('devextreme-react/text-box', () => ({
  default: vi.fn(({ value, onValueChanged, placeholder }) => (
    <input
      data-testid="dx-text-box"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      placeholder={placeholder}
    />
  )),
}));

vi.mock('devextreme-react/select-box', () => ({
  default: vi.fn(({ value, onValueChanged, dataSource, placeholder }) => (
    <select
      data-testid="dx-select-box"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value || null })}
    >
      <option value="">{placeholder || 'Select...'}</option>
      {dataSource?.map((item: { value: string; text: string } | string, idx: number) => {
        const val = typeof item === 'string' ? item : item.value;
        const text = typeof item === 'string' ? item : item.text;
        return (
          <option key={idx} value={val}>
            {text}
          </option>
        );
      })}
    </select>
  )),
}));

vi.mock('devextreme-react/tag-box', () => ({
  default: vi.fn(({ value, onValueChanged, dataSource, placeholder }) => (
    <div data-testid="dx-tag-box">
      <select
        multiple
        value={value || []}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
          onValueChanged?.({ value: selected });
        }}
      >
        {dataSource?.map((item: string, idx: number) => (
          <option key={idx} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  )),
}));

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: vi.fn(({ value, onValueChanged, label }) => (
    <div data-testid="dx-date-box">
      <label>{label}</label>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onValueChanged?.({ value: e.target.value })}
      />
    </div>
  )),
}));

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: vi.fn(({ title, subtitle, actions }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <span>{subtitle}</span>
      <div data-testid="header-actions">{actions}</div>
    </div>
  )),
  StatCard: vi.fn(({ label, value, isLoading }) => (
    <div data-testid={`stat-card-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      {isLoading ? 'Loading...' : <span>{label}: {value}</span>}
    </div>
  )),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: vi.fn(({ text, onClick, icon }) => (
    <button data-testid={`dx-button-${icon || text?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`} onClick={onClick}>
      {text}
    </button>
  )),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: vi.fn(({ children, variant }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  )),
}));

// Import the page component after mocks are set up
import AuthorizationsPage from '@/app/hr/authorizations/page';

describe('HR Authorizations Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockMutate.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', () => {
      render(<AuthorizationsPage />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      // Title from i18n: t('authorizations.title') = 'Authorizations'
      expect(screen.getByText('Authorizations')).toBeInTheDocument();
      // Subtitle from i18n: t('authorizations.description') = 'Manage authorizations and access rights'
      expect(screen.getByText('Manage authorizations and access rights')).toBeInTheDocument();
    });

    it('should render KPI stat cards', () => {
      render(<AuthorizationsPage />);

      expect(screen.getByTestId('stat-card-สิทธิ์ทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-มีผลบังคับใช้')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-รอเริ่มต้น')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ใกล้หมดอายุ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-การมอบอำนาจ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-พนักงานที่มีสิทธิ์')).toBeInTheDocument();
    });

    it('should display correct total authorizations count', () => {
      render(<AuthorizationsPage />);

      const totalCard = screen.getByTestId('stat-card-สิทธิ์ทั้งหมด');
      expect(totalCard).toHaveTextContent('4');
    });

    it('should display correct active authorizations count', () => {
      render(<AuthorizationsPage />);

      // Active = 1 (sop_approval with no end date is always active)
      // batch_release has effectiveTo in 2024 which is in the past
      const activeCard = screen.getByTestId('stat-card-มีผลบังคับใช้');
      expect(activeCard).toHaveTextContent('1');
    });

    it('should display correct delegations count', () => {
      render(<AuthorizationsPage />);

      const delegationsCard = screen.getByTestId('stat-card-การมอบอำนาจ');
      expect(delegationsCard).toHaveTextContent('1');
    });
  });

  describe('View Mode Switching', () => {
    it('should render grid view by default', () => {
      render(<AuthorizationsPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });

    it('should switch to cards view when card button is clicked', async () => {
      render(<AuthorizationsPage />);

      // Find the cards view button
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dx-data-grid')).not.toBeInTheDocument();
          // Authorization type labels should be visible in cards view
          expect(screen.getByText('ปล่อยผ่านชุด')).toBeInTheDocument();
        });
      }
    });

    it('should switch to analytics view when analytics button is clicked', async () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Filter Panel', () => {
    it('should toggle filter panel when filter button is clicked', async () => {
      render(<AuthorizationsPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      expect(filterButton).toBeInTheDocument();

      // Initially filter panel should be hidden
      expect(screen.queryByText('ตัวกรองข้อมูล')).not.toBeInTheDocument();

      // Click to show filters
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('ตัวกรองข้อมูล')).toBeInTheDocument();
      });
    });

    it('should render search text box in filter panel', async () => {
      render(<AuthorizationsPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('dx-text-box')).toBeInTheDocument();
      });
    });

    it('should render authorization type filter in filter panel', async () => {
      render(<AuthorizationsPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        // Look for select boxes (one for type, one for status)
        const selectBoxes = screen.getAllByTestId('dx-select-box');
        expect(selectBoxes.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('DataGrid', () => {
    it('should render DataGrid with correct number of rows', () => {
      render(<AuthorizationsPage />);

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-row-count', '4');
    });
  });

  describe('Cards View', () => {
    it('should group authorizations by type in cards view', async () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          // Should see type headers for groups that have authorizations
          expect(screen.getByText('ปล่อยผ่านชุด')).toBeInTheDocument();
          expect(screen.getByText('Batch Release')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Analytics View', () => {
    it('should render pie charts for distribution', async () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          const pieCharts = screen.getAllByTestId('pie-chart');
          expect(pieCharts.length).toBeGreaterThan(0);
        });
      }
    });

    it('should render distribution section titles', async () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('การกระจายตามประเภทสิทธิ์')).toBeInTheDocument();
          expect(screen.getByText('สถานะสิทธิ์อนุมัติ')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Grant Authorization Navigation', () => {
    it('should navigate to new authorization page when grant button is clicked', async () => {
      render(<AuthorizationsPage />);

      const grantButton = screen.getByTestId('dx-button-add');
      fireEvent.click(grantButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/hr/authorizations/new');
      });
    });
  });

  describe('Action Buttons', () => {
    it('should render refresh button', () => {
      render(<AuthorizationsPage />);

      expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
    });

    it('should render grant authorization button', () => {
      render(<AuthorizationsPage />);

      const grantButton = screen.getByTestId('dx-button-add');
      expect(grantButton).toBeInTheDocument();
      expect(grantButton).toHaveTextContent('มอบสิทธิ์ใหม่');
    });

    it('should render filter button', () => {
      render(<AuthorizationsPage />);

      expect(screen.getByTestId('dx-button-filter')).toBeInTheDocument();
    });
  });

  describe('View Mode Buttons', () => {
    it('should render grid view button', () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const gridButton = buttons.find(btn => btn.title === 'มุมมองตาราง');
      expect(gridButton).toBeInTheDocument();
    });

    it('should render cards view button', () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');
      expect(cardsButton).toBeInTheDocument();
    });

    it('should render analytics view button', () => {
      render(<AuthorizationsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');
      expect(analyticsButton).toBeInTheDocument();
    });
  });

  describe('Authorization Status Display', () => {
    it('should correctly identify active authorizations', () => {
      render(<AuthorizationsPage />);

      // Active = 1 (only sop_approval with no end date is currently active)
      // batch_release has effectiveTo 2024-12-31 which is in the past
      const activeCard = screen.getByTestId('stat-card-มีผลบังคับใช้');
      expect(activeCard).toHaveTextContent('1');
    });

    it('should correctly identify pending authorizations', () => {
      render(<AuthorizationsPage />);

      // Pending = 1 (change_control_approval with future start date)
      const pendingCard = screen.getByTestId('stat-card-รอเริ่มต้น');
      expect(pendingCard).toHaveTextContent('1');
    });
  });

  describe('Employees with Authorizations', () => {
    it('should count unique employees with active authorizations', () => {
      render(<AuthorizationsPage />);

      const employeesCard = screen.getByTestId('stat-card-พนักงานที่มีสิทธิ์');
      // Active authorizations: batch_release (emp 1), sop_approval (emp 2), change_control_approval (emp 4)
      // = 3 unique employees with isActive=true
      expect(employeesCard).toHaveTextContent('3');
    });
  });
});
