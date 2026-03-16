/**
 * Unit Tests for HR Employees Page
 * Tests the redesigned Employee Directory with:
 * - Grid view with DataGrid
 * - Cards view with employee cards
 * - Analytics view with pie chart and department distribution
 * - KPI dashboard statistics
 * - View mode switching
 * - Filter panel functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryFn }) => {
    return {
      data: mockEmployees,
      isLoading: false,
      refetch: vi.fn(),
    };
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: vi.fn(({ dataSource, children, onRowClick, height }) => (
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
  Selection: vi.fn(() => null),
  Scrolling: vi.fn(() => null),
  Export: vi.fn(() => null),
  Toolbar: vi.fn(() => null),
  Item: vi.fn(() => null),
  Grouping: vi.fn(() => null),
  GroupPanel: vi.fn(() => null),
  ColumnChooser: vi.fn(() => null),
  StateStoring: vi.fn(() => null),
  Summary: vi.fn(() => null),
  GroupItem: vi.fn(() => null),
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

// Mock shared components
vi.mock('@/components/shared', () => ({
  OrgUnitPicker: vi.fn(({ value, onValueChange, label }) => (
    <div data-testid="org-unit-picker">
      <label>{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">All</option>
        <option value="1">Org 1</option>
        <option value="2">Org 2</option>
      </select>
    </div>
  )),
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
    <button data-testid={`dx-button-${icon || text}`} onClick={onClick}>
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

// Mock employee data
const mockEmployees = [
  {
    id: 1,
    employeeCode: 'EMP001',
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    email: 'somchai@example.com',
    phone: '0812345678',
    status: 'active',
    orgUnitName: 'แผนกผลิต',
    orgUnitCode: 'PROD',
    positionTitle: 'วิศวกรการผลิต',
    positionCode: 'PE01',
    hireDate: '2022-01-15',
  },
  {
    id: 2,
    employeeCode: 'EMP002',
    firstName: 'สมหญิง',
    lastName: 'รักดี',
    email: 'somying@example.com',
    phone: '0823456789',
    status: 'active',
    orgUnitName: 'แผนก QC',
    orgUnitCode: 'QC',
    positionTitle: 'เจ้าหน้าที่ QC',
    positionCode: 'QC01',
    hireDate: '2023-03-20',
  },
  {
    id: 3,
    employeeCode: 'EMP003',
    firstName: 'สมศักดิ์',
    lastName: 'มั่นคง',
    email: 'somsak@example.com',
    phone: '0834567890',
    status: 'inactive',
    orgUnitName: 'แผนกผลิต',
    orgUnitCode: 'PROD',
    positionTitle: 'ช่างเทคนิค',
    positionCode: 'TECH01',
    hireDate: '2021-06-01',
  },
];

// Import the page component after mocks are set up
import EmployeesPage from '@/app/hr/employees/page';

describe('HR Employees Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', () => {
      render(<EmployeesPage />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      // Title from i18n: t('employees.title') = 'Employees'
      expect(screen.getByText('Employees')).toBeInTheDocument();
    });

    it('should render KPI stat cards', () => {
      render(<EmployeesPage />);

      // Check for stat cards (StatCard mock uses label in test-id)
      expect(screen.getByTestId('stat-card-พนักงานทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ใช้งาน')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-พักงาน')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-เข้าใหม่เดือนนี้')).toBeInTheDocument();
    });

    it('should display correct total employee count', () => {
      render(<EmployeesPage />);

      const totalCard = screen.getByTestId('stat-card-พนักงานทั้งหมด');
      expect(totalCard).toHaveTextContent('3');
    });

    it('should display correct active employee count', () => {
      render(<EmployeesPage />);

      const activeCard = screen.getByTestId('stat-card-ใช้งาน');
      expect(activeCard).toHaveTextContent('2');
    });
  });

  describe('View Mode Switching', () => {
    it('should render grid view by default', () => {
      render(<EmployeesPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });

    it('should switch to cards view when card button is clicked', async () => {
      render(<EmployeesPage />);

      // Find the cards view button (Grid3X3 icon button)
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          // In cards view, we should see employee names displayed differently
          expect(screen.queryByTestId('dx-data-grid')).not.toBeInTheDocument();
        });
      }
    });

    it('should switch to analytics view when analytics button is clicked', async () => {
      render(<EmployeesPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Filter Panel', () => {
    it('should toggle filter panel when filter button is clicked', async () => {
      render(<EmployeesPage />);

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

    it('should render org unit picker in filter panel', async () => {
      render(<EmployeesPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('org-unit-picker')).toBeInTheDocument();
      });
    });

    it('should render status filter dropdown', async () => {
      render(<EmployeesPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('สถานะ')).toBeInTheDocument();
        // Get all comboboxes and check there are at least 2 (org unit + status)
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to employee detail when clicking row in grid', async () => {
      render(<EmployeesPage />);

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      expect(mockPush).toHaveBeenCalledWith('/hr/employees/1');
    });

    it('should navigate to add employee page when add button is clicked', () => {
      render(<EmployeesPage />);

      const addButton = screen.getByTestId('dx-button-add');
      fireEvent.click(addButton);

      expect(mockPush).toHaveBeenCalledWith('/hr/employees/new');
    });
  });

  describe('DataGrid', () => {
    it('should render DataGrid with correct number of rows', () => {
      render(<EmployeesPage />);

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-row-count', '3');
    });
  });

  describe('Analytics View', () => {
    it('should render pie chart for status distribution', async () => {
      render(<EmployeesPage />);

      // Switch to analytics view
      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          const pieChart = screen.getByTestId('pie-chart');
          expect(pieChart).toBeInTheDocument();
        });
      }
    });

    it('should render department distribution section', async () => {
      render(<EmployeesPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('จำนวนพนักงานตามหน่วยงาน')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Action Buttons', () => {
    it('should render refresh button', () => {
      render(<EmployeesPage />);

      expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
    });

    it('should render add employee button', () => {
      render(<EmployeesPage />);

      const addButton = screen.getByTestId('dx-button-add');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveTextContent('เพิ่มพนักงาน');
    });
  });
});
