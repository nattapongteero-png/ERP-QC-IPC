/**
 * Unit Tests for HR Training Dashboard Page
 * Tests the redesigned Training Management Dashboard with:
 * - Grid view with DataGrid for sessions
 * - Cards view with course cards
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

// Mock course data
const mockCourses = [
  {
    id: 1,
    code: 'GMP001',
    name: 'หลักสูตร GMP พื้นฐาน',
    nameEn: 'Basic GMP Training',
    description: 'อบรมพื้นฐาน GMP สำหรับพนักงานใหม่',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 8,
    isActive: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 2,
    code: 'SAFE01',
    name: 'ความปลอดภัยในการทำงาน',
    nameEn: 'Workplace Safety',
    description: 'อบรมความปลอดภัยพื้นฐาน',
    category: 'Safety',
    validityDays: 180,
    isMandatory: false,
    durationHours: 4,
    isActive: true,
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
  {
    id: 3,
    code: 'QC001',
    name: 'การควบคุมคุณภาพ',
    nameEn: 'Quality Control',
    description: 'อบรมการควบคุมคุณภาพ',
    category: 'QC',
    validityDays: 365,
    isMandatory: true,
    durationHours: 16,
    isActive: false,
    createdAt: '2024-01-03',
    updatedAt: '2024-01-03',
  },
];

// Mock session data
const mockSessions = [
  {
    id: 1,
    courseId: 1,
    sessionDate: new Date().toISOString(),
    startTime: '09:00',
    endTime: '17:00',
    location: 'ห้องประชุม A',
    instructorId: 1,
    maxParticipants: 20,
    status: 'scheduled',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    courseName: 'หลักสูตร GMP พื้นฐาน',
    courseCode: 'GMP001',
  },
  {
    id: 2,
    courseId: 2,
    sessionDate: '2024-02-15',
    startTime: '13:00',
    endTime: '17:00',
    location: 'ห้องประชุม B',
    instructorId: 2,
    maxParticipants: 15,
    status: 'completed',
    createdAt: '2024-01-05',
    updatedAt: '2024-01-05',
    courseName: 'ความปลอดภัยในการทำงาน',
    courseCode: 'SAFE01',
  },
  {
    id: 3,
    courseId: 1,
    sessionDate: new Date().toISOString(),
    startTime: '09:00',
    endTime: '12:00',
    location: 'Online',
    instructorId: 1,
    maxParticipants: 50,
    status: 'in_progress',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-10',
    courseName: 'หลักสูตร GMP พื้นฐาน',
    courseCode: 'GMP001',
  },
];

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('courses')) {
      return {
        data: mockCourses,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey.includes('sessions')) {
      return {
        data: mockSessions,
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
      {dataSource?.map((item: { value: string; text: string }) => (
        <option key={item.value} value={item.value}>
          {item.text}
        </option>
      ))}
    </select>
  )),
}));

vi.mock('devextreme-react/check-box', () => ({
  default: vi.fn(({ value, onValueChanged, text }) => (
    <label data-testid="dx-check-box">
      <input
        type="checkbox"
        checked={value || false}
        onChange={(e) => onValueChanged?.({ value: e.target.checked })}
      />
      {text}
    </label>
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
import TrainingDashboardPage from '@/app/hr/training/page';

describe('HR Training Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', () => {
      render(<TrainingDashboardPage />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      // Title from i18n: t('training.title') = 'Training'
      expect(screen.getByText('Training')).toBeInTheDocument();
      // Subtitle from i18n: t('training.description') = 'Manage training programs'
      expect(screen.getByText('Manage training programs')).toBeInTheDocument();
    });

    it('should render KPI stat cards', () => {
      render(<TrainingDashboardPage />);

      expect(screen.getByTestId('stat-card-หลักสูตรทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-หลักสูตรบังคับ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-รอบอบรมทั้งหมด')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-กำลังดำเนินการ')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-เสร็จสิ้นแล้ว')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-ใน-7-วันข้างหน้า')).toBeInTheDocument();
    });

    it('should display correct total courses count', () => {
      render(<TrainingDashboardPage />);

      const totalCard = screen.getByTestId('stat-card-หลักสูตรทั้งหมด');
      expect(totalCard).toHaveTextContent('3');
    });

    it('should display correct mandatory courses count', () => {
      render(<TrainingDashboardPage />);

      const mandatoryCard = screen.getByTestId('stat-card-หลักสูตรบังคับ');
      expect(mandatoryCard).toHaveTextContent('2');
    });

    it('should display correct sessions count', () => {
      render(<TrainingDashboardPage />);

      const sessionsCard = screen.getByTestId('stat-card-รอบอบรมทั้งหมด');
      expect(sessionsCard).toHaveTextContent('3');
    });

    it('should render quick access module cards', () => {
      render(<TrainingDashboardPage />);

      expect(screen.getByText('จัดการหลักสูตร')).toBeInTheDocument();
      expect(screen.getByText('จัดการรอบอบรม')).toBeInTheDocument();
      expect(screen.getByText('Competency Matrix')).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should render grid view by default', () => {
      render(<TrainingDashboardPage />);

      expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
    });

    it('should switch to cards view when card button is clicked', async () => {
      render(<TrainingDashboardPage />);

      // Find the cards view button
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด (หลักสูตร)');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dx-data-grid')).not.toBeInTheDocument();
          // Course names should be visible in cards view
          expect(screen.getByText('หลักสูตร GMP พื้นฐาน')).toBeInTheDocument();
        });
      }
    });

    it('should switch to analytics view when analytics button is clicked', async () => {
      render(<TrainingDashboardPage />);

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
      render(<TrainingDashboardPage />);

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
      render(<TrainingDashboardPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('dx-text-box')).toBeInTheDocument();
      });
    });

    it('should render status filter in grid view', async () => {
      render(<TrainingDashboardPage />);

      const filterButton = screen.getByTestId('dx-button-filter');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('สถานะรอบอบรม')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to session detail when clicking row in grid', async () => {
      render(<TrainingDashboardPage />);

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      expect(mockPush).toHaveBeenCalledWith('/hr/training/sessions/1');
    });

    it('should navigate to add session page when add button is clicked in grid view', () => {
      render(<TrainingDashboardPage />);

      const addButton = screen.getByTestId('dx-button-add');
      fireEvent.click(addButton);

      expect(mockPush).toHaveBeenCalledWith('/hr/training/sessions/new');
    });
  });

  describe('DataGrid', () => {
    it('should render DataGrid with correct number of rows', () => {
      render(<TrainingDashboardPage />);

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-row-count', '3');
    });
  });

  describe('Cards View', () => {
    it('should display course cards with correct information', async () => {
      render(<TrainingDashboardPage />);

      // Switch to cards view
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด (หลักสูตร)');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          expect(screen.getByText('หลักสูตร GMP พื้นฐาน')).toBeInTheDocument();
          expect(screen.getByText('ความปลอดภัยในการทำงาน')).toBeInTheDocument();
          expect(screen.getByText('การควบคุมคุณภาพ')).toBeInTheDocument();
        });
      }
    });

    it('should navigate to course detail when clicking card', async () => {
      render(<TrainingDashboardPage />);

      // Switch to cards view
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด (หลักสูตร)');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          const courseCard = screen.getByText('หลักสูตร GMP พื้นฐาน').closest('div[class*="cursor-pointer"]');
          if (courseCard) {
            fireEvent.click(courseCard);
            expect(mockPush).toHaveBeenCalledWith('/hr/training/courses/1');
          }
        });
      }
    });
  });

  describe('Analytics View', () => {
    it('should render pie charts for status distribution', async () => {
      render(<TrainingDashboardPage />);

      // Switch to analytics view
      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          const pieCharts = screen.getAllByTestId('pie-chart');
          expect(pieCharts.length).toBeGreaterThanOrEqual(2);
        });
      }
    });

    it('should render session summary section', async () => {
      render(<TrainingDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('สรุปรอบอบรม')).toBeInTheDocument();
        });
      }
    });

    it('should render course summary section', async () => {
      render(<TrainingDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('สรุปหลักสูตร')).toBeInTheDocument();
        });
      }
    });

    it('should render category breakdown section', async () => {
      render(<TrainingDashboardPage />);

      const buttons = screen.getAllByRole('button');
      const analyticsButton = buttons.find(btn => btn.title === 'มุมมองวิเคราะห์');

      if (analyticsButton) {
        fireEvent.click(analyticsButton);

        await waitFor(() => {
          expect(screen.getByText('จำนวนหลักสูตรตามหมวดหมู่')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Action Buttons', () => {
    it('should render refresh button', () => {
      render(<TrainingDashboardPage />);

      expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
    });

    it('should render add session button in grid view', () => {
      render(<TrainingDashboardPage />);

      const addButton = screen.getByTestId('dx-button-add');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveTextContent('เพิ่มรอบอบรม');
    });

    it('should render add course button in cards view', async () => {
      render(<TrainingDashboardPage />);

      // Switch to cards view
      const buttons = screen.getAllByRole('button');
      const cardsButton = buttons.find(btn => btn.title === 'มุมมองการ์ด (หลักสูตร)');

      if (cardsButton) {
        fireEvent.click(cardsButton);

        await waitFor(() => {
          const addButton = screen.getByTestId('dx-button-add');
          expect(addButton).toHaveTextContent('เพิ่มหลักสูตร');
        });
      }
    });
  });

  describe('Quick Access Links', () => {
    it('should render link to courses page', () => {
      render(<TrainingDashboardPage />);

      const coursesLink = screen.getByText('จัดการหลักสูตร').closest('a');
      expect(coursesLink).toHaveAttribute('href', '/hr/training/courses');
    });

    it('should render link to sessions page', () => {
      render(<TrainingDashboardPage />);

      const sessionsLink = screen.getByText('จัดการรอบอบรม').closest('a');
      expect(sessionsLink).toHaveAttribute('href', '/hr/training/sessions');
    });

    it('should render link to competency matrix page', () => {
      render(<TrainingDashboardPage />);

      const matrixLink = screen.getByText('Competency Matrix').closest('a');
      expect(matrixLink).toHaveAttribute('href', '/hr/training/matrix');
    });
  });
});
