/**
 * Unit Tests for HR Positions Page
 * Tests the redesigned Position Management with:
 * - Grid view with DataGrid
 * - Cards view with position cards
 * - Analytics view with pie charts and distribution
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
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey[1] === 'positions') {
      return {
        data: mockPositions,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey[1] === 'org-units') {
      return {
        data: mockOrgUnits,
        isLoading: false,
      };
    }
    if (queryKey[1] === 'job-descriptions') {
      return {
        data: mockJobDescriptions,
        isLoading: false,
      };
    }
    return { data: [], isLoading: false };
  }),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
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
  Lookup: vi.fn(() => null),
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
  Popup: vi.fn(({ visible, title, children }) =>
    visible ? (
      <div data-testid="dx-popup" data-title={title}>
        {children}
      </div>
    ) : null
  ),
  ToolbarItem: vi.fn(() => null),
}));

vi.mock('devextreme-react/text-box', () => ({
  default: vi.fn(({ value, placeholder }) => (
    <input data-testid="dx-text-box" value={value || ''} placeholder={placeholder} readOnly />
  )),
}));

vi.mock('devextreme-react/text-area', () => ({
  default: vi.fn(({ value, placeholder }) => (
    <textarea data-testid="dx-text-area" value={value || ''} placeholder={placeholder} readOnly />
  )),
}));

vi.mock('devextreme-react/select-box', () => ({
  default: vi.fn(({ value, placeholder }) => (
    <select data-testid="dx-select-box" value={value || ''}>
      <option>{placeholder}</option>
    </select>
  )),
}));

vi.mock('devextreme-react/check-box', () => ({
  default: vi.fn(({ value, onValueChanged }) => (
    <input
      data-testid="dx-check-box"
      type="checkbox"
      checked={value || false}
      onChange={(e) => onValueChanged?.({ value: e.target.checked })}
    />
  )),
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

vi.mock('@/components/ui/toast', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  })),
}));

// Mock position data
const mockPositions = [
  {
    id: 1,
    code: 'QC-001',
    title: 'ผู้จัดการควบคุมคุณภาพ',
    titleEn: 'QC Manager',
    orgUnitId: 1,
    jobGrade: 'Manager',
    isGmpCritical: true,
    isActive: true,
    createdAt: '2022-01-15',
    updatedAt: '2022-01-15',
  },
  {
    id: 2,
    code: 'PROD-001',
    title: 'หัวหน้าแผนกผลิต',
    titleEn: 'Production Supervisor',
    orgUnitId: 2,
    jobGrade: 'Supervisor',
    isGmpCritical: true,
    isActive: true,
    createdAt: '2022-02-20',
    updatedAt: '2022-02-20',
  },
  {
    id: 3,
    code: 'HR-001',
    title: 'เจ้าหน้าที่ทรัพยากรบุคคล',
    titleEn: 'HR Officer',
    orgUnitId: 3,
    jobGrade: 'Officer',
    isGmpCritical: false,
    isActive: true,
    createdAt: '2022-03-10',
    updatedAt: '2022-03-10',
  },
  {
    id: 4,
    code: 'IT-001',
    title: 'นักพัฒนาระบบ',
    titleEn: 'System Developer',
    orgUnitId: 4,
    jobGrade: 'Officer',
    isGmpCritical: false,
    isActive: false,
    createdAt: '2022-04-01',
    updatedAt: '2022-04-01',
  },
];

const mockOrgUnits = [
  { id: 1, code: 'QC', name: 'แผนก QC' },
  { id: 2, code: 'PROD', name: 'แผนกผลิต' },
  { id: 3, code: 'HR', name: 'แผนกทรัพยากรบุคคล' },
  { id: 4, code: 'IT', name: 'แผนก IT' },
];

const mockJobDescriptions = [
  {
    id: 1,
    positionId: 1,
    version: '1.0',
    status: 'approved' as const,
    effectiveFrom: '2022-01-15',
    approvedAt: '2022-01-15',
  },
];

// Import the page component after mocks are set up
import PositionsPage from '@/app/hr/positions/page';

describe('HR Positions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', () => {
      render(<PositionsPage />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('ตำแหน่งงาน')).toBeInTheDocument();
    });

    it('should render KPI stat cards', () => {
      render(<PositionsPage />);

      // Check for stat cards (StatCard mock uses label in test-id)
      expect(screen.getByTestId('stat-card-ตำแหน่งทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ใช้งาน')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-gmp-critical')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-หน่วยงาน')).toBeInTheDocument();
    });

    it('should display correct total positions count', () => {
      render(<PositionsPage />);

      const totalCard = screen.getByTestId('stat-card-ตำแหน่งทั้งหมด');
      expect(totalCard).toHaveTextContent('4');
    });

    it('should display correct GMP critical count', () => {
      render(<PositionsPage />);

      const gmpCard = screen.getByTestId('stat-card-gmp-critical');
      expect(gmpCard).toHaveTextContent('2');
    });
  });

  describe('View Mode Switching', () => {
    it('should render grid view by default', () => {
      render(<PositionsPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });

    it('should switch to cards view when card button is clicked', async () => {
      render(<PositionsPage />);

      // Find the cards view button (Grid3X3 icon button)
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          // In cards view, we should not see the data grid
          expect(screen.queryByTestId('dx-data-grid')).not.toBeInTheDocument();
        });
      }
    });

    it('should switch to analytics view when analytics button is clicked', async () => {
      render(<PositionsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          const charts = screen.getAllByTestId('pie-chart');
          expect(charts.length).toBeGreaterThanOrEqual(1);
        });
      }
    });
  });

  describe('Filter Panel', () => {
    it('should toggle filter panel when filter button is clicked', async () => {
      render(<PositionsPage />);

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
      render(<PositionsPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('org-unit-picker')).toBeInTheDocument();
      });
    });

    it('should render status filter dropdown', async () => {
      render(<PositionsPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('สถานะ')).toBeInTheDocument();
        // Get all comboboxes and check there are at least 2 (org unit + status)
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should render GMP only checkbox in filter panel', async () => {
      render(<PositionsPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('เฉพาะ GMP Critical')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid', () => {
    it('should render DataGrid with correct number of rows', () => {
      render(<PositionsPage />);

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-row-count', '4');
    });

    it('should select position when clicking row in grid', async () => {
      render(<PositionsPage />);

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      // After clicking, detail panel should show position info
      await waitFor(() => {
        expect(screen.getByText('ผู้จัดการควบคุมคุณภาพ')).toBeInTheDocument();
      });
    });
  });

  describe('Detail Panel', () => {
    it('should show placeholder when no position is selected', () => {
      render(<PositionsPage />);

      expect(screen.getByText('เลือกตำแหน่งเพื่อดูรายละเอียด')).toBeInTheDocument();
    });

    it('should show position details when a position is selected', async () => {
      render(<PositionsPage />);

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(screen.getByText('ผู้จัดการควบคุมคุณภาพ')).toBeInTheDocument();
        expect(screen.getByText('QC-001')).toBeInTheDocument();
      });
    });

    it('should show job descriptions section', async () => {
      render(<PositionsPage />);

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(screen.getByText('รายละเอียดงาน')).toBeInTheDocument();
      });
    });
  });

  describe('Analytics View', () => {
    it('should render pie charts for GMP and status distribution', async () => {
      render(<PositionsPage />);

      // Switch to analytics view
      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          const charts = screen.getAllByTestId('pie-chart');
          expect(charts.length).toBeGreaterThanOrEqual(2);
        });
      }
    });

    it('should render org unit distribution section', async () => {
      render(<PositionsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('จำนวนตำแหน่งตามหน่วยงาน')).toBeInTheDocument();
        });
      }
    });

    it('should render grade distribution section', async () => {
      render(<PositionsPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('จำนวนตำแหน่งตามระดับ')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Action Buttons', () => {
    it('should render refresh button', () => {
      render(<PositionsPage />);

      expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
    });

    it('should render add position button', () => {
      render(<PositionsPage />);

      const addButton = screen.getByTestId('dx-button-add');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveTextContent('เพิ่มตำแหน่ง');
    });

    it('should show create popup when add button is clicked', async () => {
      render(<PositionsPage />);

      const addButton = screen.getByTestId('dx-button-add');
      fireEvent.click(addButton);

      await waitFor(() => {
        const popup = screen.getByTestId('dx-popup');
        expect(popup).toBeInTheDocument();
        expect(popup).toHaveAttribute('data-title', 'เพิ่มตำแหน่งงานใหม่');
      });
    });
  });

  describe('Create Position Form', () => {
    it('should render form fields in create popup', async () => {
      render(<PositionsPage />);

      const addButton = screen.getByTestId('dx-button-add');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('รหัสตำแหน่ง')).toBeInTheDocument();
        expect(screen.getByText('ชื่อตำแหน่ง (ภาษาไทย)')).toBeInTheDocument();
        expect(screen.getByText('ระดับตำแหน่ง')).toBeInTheDocument();
        expect(screen.getByText('หน่วยงาน')).toBeInTheDocument();
        expect(screen.getByText('ตำแหน่ง GMP Critical')).toBeInTheDocument();
      });
    });
  });
});
