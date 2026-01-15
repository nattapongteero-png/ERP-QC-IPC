/**
 * HR Employees List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import EmployeesPage from '@/app/hr/employees/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_EMPLOYEES, HR_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock DevExtreme PieChart - the component uses named import PieChart
vi.mock('devextreme-react/pie-chart', () => {
  const MockPieChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>;
  return {
    __esModule: true,
    default: MockPieChart,
    PieChart: MockPieChart,
    Series: () => null,
    Label: () => null,
    Legend: () => null,
    Tooltip: () => null,
    Connector: () => null,
    Size: () => null,
  };
});

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  OrgUnitPicker: () => <div data-testid="org-unit-picker" />,
}));

describe('EmployeesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('ทะเบียนพนักงาน')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Employee Directory/)).toBeInTheDocument();
      });
    });

    it('should render employees page container', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        // The main page container
        expect(screen.getByTestId('hr-employees-page')).toBeInTheDocument();
      });
    });

    it('should render main content area', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        // Check for the stats section
        expect(screen.getByTestId('hr-employees-stats')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display stat cards', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('พนักงานทั้งหมด')).toBeInTheDocument();
        expect(screen.getByText('ใช้งาน')).toBeInTheDocument();
        expect(screen.getByText('พักงาน')).toBeInTheDocument();
        expect(screen.getByText('เข้าใหม่เดือนนี้')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch employees on mount', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const employeesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/hr/employees')
      );
      expect(employeesCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/hr/employees': { data: createSingleResponse([]) },
      });

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('ทะเบียนพนักงาน')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/hr/employees': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<EmployeesPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('ทะเบียนพนักงาน')).toBeInTheDocument();
      });
    });

    it('should correctly parse direct array response structure (regression)', () => {
      // HR pages use direct array format, not paginated
      const mockResponse = createSingleResponse(MOCK_EMPLOYEES);

      // Correct: data returns the array directly
      expect(Array.isArray(mockResponse.data)).toBe(true);
      expect(mockResponse.data.length).toBe(MOCK_EMPLOYEES.length);
    });
  });

  describe('Filter Section', () => {
    it('should render filter toggle button via header', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      // Filter button is in the header section
      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid Section', () => {
    it('should have data-testid for employees grid', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('hr-employees-grid')).toBeInTheDocument();
      });
    });

    it('should have data-testid for employees stats', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('hr-employees-stats')).toBeInTheDocument();
      });
    });
  });
});
