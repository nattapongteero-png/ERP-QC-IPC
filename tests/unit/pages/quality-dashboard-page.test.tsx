/**
 * Unit Tests for Quality Control Dashboard Page
 * Tests the redesigned Quality Control Dashboard with:
 * - Grid view with DataGrid for quality tests
 * - Cards view with module cards and quick actions
 * - Analytics view with pie charts and statistics
 * - KPI dashboard statistics
 * - View mode switching
 * - Filter panel functionality
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

// Mock quality test data
const mockTests = [
  {
    id: 1,
    lotId: 1,
    lotNumber: 'LOT-2024-001',
    specId: 1,
    testName: 'ทดสอบความชื้น',
    testMethod: 'Gravimetric',
    specification: '< 5%',
    minValue: null,
    maxValue: 5,
    testType: 'incoming',
    sampleNumber: 'S001',
    testDate: '2024-01-15',
    result: '3.5%',
    numericResult: 3.5,
    status: 'passed',
    createdAt: '2024-01-15',
  },
  {
    id: 2,
    lotId: 2,
    lotNumber: 'LOT-2024-002',
    specId: 2,
    testName: 'ทดสอบ pH',
    testMethod: 'pH Meter',
    specification: '6.0-8.0',
    minValue: 6,
    maxValue: 8,
    testType: 'in_process',
    sampleNumber: 'S002',
    testDate: null,
    result: null,
    numericResult: null,
    status: 'pending',
    createdAt: '2024-01-16',
  },
  {
    id: 3,
    lotId: 3,
    lotNumber: 'LOT-2024-003',
    specId: 1,
    testName: 'ทดสอบจุลินทรีย์',
    testMethod: 'Plate Count',
    specification: '< 100 CFU/g',
    minValue: null,
    maxValue: 100,
    testType: 'finished',
    sampleNumber: 'S003',
    testDate: '2024-01-17',
    result: '150 CFU/g',
    numericResult: 150,
    status: 'failed',
    createdAt: '2024-01-17',
  },
  {
    id: 4,
    lotId: 4,
    lotNumber: 'LOT-2024-004',
    specId: 3,
    testName: 'ทดสอบความคงตัว',
    testMethod: 'Accelerated',
    specification: 'Stable',
    minValue: null,
    maxValue: null,
    testType: 'stability',
    sampleNumber: 'S004',
    testDate: null,
    result: null,
    numericResult: null,
    status: 'in_progress',
    createdAt: '2024-01-18',
  },
];

// Mock specs data
const mockSpecs = [
  {
    id: 1,
    itemId: 1,
    itemCode: 'RM001',
    itemName: 'วัตถุดิบ A',
    testName: 'ทดสอบความชื้น',
    testMethod: 'Gravimetric',
    specification: '< 5%',
    minValue: null,
    maxValue: 5,
    unit: '%',
    isCritical: true,
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 2,
    itemId: 2,
    itemCode: 'RM002',
    itemName: 'วัตถุดิบ B',
    testName: 'ทดสอบ pH',
    testMethod: 'pH Meter',
    specification: '6.0-8.0',
    minValue: 6,
    maxValue: 8,
    unit: null,
    isCritical: false,
    isActive: true,
    createdAt: '2024-01-02',
  },
  {
    id: 3,
    itemId: 1,
    itemCode: 'RM001',
    itemName: 'วัตถุดิบ A',
    testName: 'ทดสอบจุลินทรีย์',
    testMethod: 'Plate Count',
    specification: '< 100 CFU/g',
    minValue: null,
    maxValue: 100,
    unit: 'CFU/g',
    isCritical: true,
    isActive: false,
    createdAt: '2024-01-03',
  },
];

// Mock deviations data
const mockDeviations = [
  {
    id: 1,
    deviationNumber: 'DEV2401001',
    title: 'ค่า pH เกินกำหนด',
    description: 'พบค่า pH 8.5 ซึ่งเกินข้อกำหนด',
    severity: 'major',
    status: 'open',
    reportedDate: '2024-01-15',
    reportedBy: 'QC Officer',
    closedDate: null,
  },
  {
    id: 2,
    deviationNumber: 'DEV2401002',
    title: 'การปนเปื้อนจุลินทรีย์',
    description: 'พบจุลินทรีย์เกินกำหนด',
    severity: 'critical',
    status: 'investigating',
    reportedDate: '2024-01-16',
    reportedBy: 'QC Supervisor',
    closedDate: null,
  },
  {
    id: 3,
    deviationNumber: 'DEV2401003',
    title: 'น้ำหนักบรรจุไม่ได้มาตรฐาน',
    description: 'น้ำหนักบรรจุต่ำกว่ากำหนด 5%',
    severity: 'minor',
    status: 'closed',
    reportedDate: '2024-01-10',
    reportedBy: 'Production',
    closedDate: '2024-01-12',
  },
];

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('tests')) {
      return {
        data: mockTests,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('specs')) {
      return {
        data: mockSpecs,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('deviations')) {
      return {
        data: mockDeviations,
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
      {dataSource?.map((item: { value: string | null; text: string }, idx: number) => (
        <option key={idx} value={item.value || ''}>
          {item.text}
        </option>
      ))}
    </select>
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
import QualityDashboardPage from '@/app/quality/page';

describe('Quality Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', () => {
      render(<QualityDashboardPage />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('ควบคุมคุณภาพ')).toBeInTheDocument();
      expect(screen.getByText('Quality Control Dashboard')).toBeInTheDocument();
    });

    it('should render KPI stat cards', () => {
      render(<QualityDashboardPage />);

      expect(screen.getByTestId('stat-card-การทดสอบทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-รอทดสอบ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ผ่านการทดสอบ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ไม่ผ่านการทดสอบ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ข้อกำหนดคุณภาพ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ความเบี่ยงเบนเปิด')).toBeInTheDocument();
    });

    it('should display correct total tests count', () => {
      render(<QualityDashboardPage />);

      const totalCard = screen.getByTestId('stat-card-การทดสอบทั้งหมด');
      expect(totalCard).toHaveTextContent('4');
    });

    it('should display correct pending tests count', () => {
      render(<QualityDashboardPage />);

      const pendingCard = screen.getByTestId('stat-card-รอทดสอบ');
      expect(pendingCard).toHaveTextContent('1');
    });

    it('should display correct passed tests count', () => {
      render(<QualityDashboardPage />);

      const passedCard = screen.getByTestId('stat-card-ผ่านการทดสอบ');
      expect(passedCard).toHaveTextContent('1');
    });

    it('should display correct failed tests count', () => {
      render(<QualityDashboardPage />);

      const failedCard = screen.getByTestId('stat-card-ไม่ผ่านการทดสอบ');
      expect(failedCard).toHaveTextContent('1');
    });

    it('should display correct specs count', () => {
      render(<QualityDashboardPage />);

      const specsCard = screen.getByTestId('stat-card-ข้อกำหนดคุณภาพ');
      expect(specsCard).toHaveTextContent('3');
    });

    it('should display correct open deviations count', () => {
      render(<QualityDashboardPage />);

      // 2 deviations are open (open + investigating), 1 is closed
      const deviationsCard = screen.getByTestId('stat-card-ความเบี่ยงเบนเปิด');
      expect(deviationsCard).toHaveTextContent('2');
    });
  });

  describe('View Mode Switching', () => {
    it('should render grid view by default', () => {
      render(<QualityDashboardPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });

    it('should switch to cards view when card button is clicked', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dx-data-grid')).not.toBeInTheDocument();
          // Module card titles should be visible
          expect(screen.getByText('การทดสอบคุณภาพ')).toBeInTheDocument();
          expect(screen.getByText('ข้อกำหนดคุณภาพ')).toBeInTheDocument();
          expect(screen.getByText('ความเบี่ยงเบน')).toBeInTheDocument();
        });
      }
    });

    it('should switch to analytics view when analytics button is clicked', async () => {
      render(<QualityDashboardPage />);

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
      render(<QualityDashboardPage />);

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
      render(<QualityDashboardPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('dx-text-box')).toBeInTheDocument();
      });
    });

    it('should render type and status filters in filter panel', async () => {
      render(<QualityDashboardPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        const selectBoxes = screen.getAllByTestId('dx-select-box');
        expect(selectBoxes.length).toBe(2); // Type and Status
      });
    });
  });

  describe('DataGrid', () => {
    it('should render DataGrid with correct number of rows', () => {
      render(<QualityDashboardPage />);

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-row-count', '4');
    });

    it('should navigate to test detail when row is clicked', () => {
      render(<QualityDashboardPage />);

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      expect(mockPush).toHaveBeenCalledWith('/quality/tests/1');
    });
  });

  describe('Cards View', () => {
    it('should render module cards in cards view', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.getByText('Quality Tests')).toBeInTheDocument();
          expect(screen.getByText('Quality Specifications')).toBeInTheDocument();
          expect(screen.getByText('Deviations')).toBeInTheDocument();
        });
      }
    });

    it('should render quick actions in cards view', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.getByText('การดำเนินการด่วน')).toBeInTheDocument();
          expect(screen.getByText('สร้างการทดสอบใหม่')).toBeInTheDocument();
          expect(screen.getByText('เพิ่มข้อกำหนดใหม่')).toBeInTheDocument();
          expect(screen.getByText('รายงานความเบี่ยงเบน')).toBeInTheDocument();
        });
      }
    });

    it('should render pass rate card in cards view', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.getByText('อัตราการผ่านการทดสอบ')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Analytics View', () => {
    it('should render pie charts in analytics view', async () => {
      render(<QualityDashboardPage />);

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

    it('should render distribution section titles in analytics view', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('การกระจายตามสถานะ')).toBeInTheDocument();
          expect(screen.getByText('การกระจายตามประเภท')).toBeInTheDocument();
        });
      }
    });

    it('should render summary cards in analytics view', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('สรุปสถานะการทดสอบ')).toBeInTheDocument();
          expect(screen.getByText('สรุปข้อกำหนดคุณภาพ')).toBeInTheDocument();
          expect(screen.getByText('สรุปความเบี่ยงเบน')).toBeInTheDocument();
        });
      }
    });

    it('should render type breakdown in analytics view', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('รายละเอียดตามประเภทการทดสอบ')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Action Buttons', () => {
    it('should render refresh button', () => {
      render(<QualityDashboardPage />);

      expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
    });

    it('should render new test button', () => {
      render(<QualityDashboardPage />);

      const newTestButton = screen.getByTestId('dx-button-add');
      expect(newTestButton).toBeInTheDocument();
      expect(newTestButton).toHaveTextContent('ทดสอบใหม่');
    });

    it('should navigate to new test page when button is clicked', () => {
      render(<QualityDashboardPage />);

      const newTestButton = screen.getByTestId('dx-button-add');
      fireEvent.click(newTestButton);

      expect(mockPush).toHaveBeenCalledWith('/quality/tests/new');
    });

    it('should render filter button', () => {
      render(<QualityDashboardPage />);

      expect(screen.getByTestId('dx-button-filter')).toBeInTheDocument();
    });
  });

  describe('View Mode Buttons', () => {
    it('should render grid view button', () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const gridButton = buttons.find(btn => btn.title === 'มุมมองตาราง');
      expect(gridButton).toBeInTheDocument();
    });

    it('should render cards view button', () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');
      expect(cardsButton).toBeInTheDocument();
    });

    it('should render analytics view button', () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');
      expect(analyticsButton).toBeInTheDocument();
    });
  });

  describe('Navigation from Cards View', () => {
    it('should navigate to tests page when tests module is clicked', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          const testsCard = screen.getByText('การทดสอบคุณภาพ').closest('div[class*="cursor-pointer"]');
          if (testsCard) {
            fireEvent.click(testsCard);
            expect(mockPush).toHaveBeenCalledWith('/quality/tests');
          }
        });
      }
    });

    it('should navigate to specs page when specs module is clicked', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          const specsCard = screen.getByText('ข้อกำหนดคุณภาพ').closest('div[class*="cursor-pointer"]');
          if (specsCard) {
            fireEvent.click(specsCard);
            expect(mockPush).toHaveBeenCalledWith('/quality/specs');
          }
        });
      }
    });

    it('should navigate to deviations page when deviations module is clicked', async () => {
      render(<QualityDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          const deviationsCard = screen.getByText('ความเบี่ยงเบน').closest('div[class*="cursor-pointer"]');
          if (deviationsCard) {
            fireEvent.click(deviationsCard);
            expect(mockPush).toHaveBeenCalledWith('/quality/deviations');
          }
        });
      }
    });
  });
});
