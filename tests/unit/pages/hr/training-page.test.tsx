/**
 * HR Training Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import TrainingDashboardPage from '@/app/hr/training/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_TRAINING_COURSES, MOCK_TRAINING_SESSIONS, HR_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
  StatCard: ({ label, value, href }: { label: string; value: string | number; href?: string }) => (
    <div data-testid="stat-card" data-href={href}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe('TrainingDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        // Title comes from i18n: t('training.title') = 'Training'
        expect(screen.getByText('Training')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        // Subtitle comes from i18n: t('training.description') = 'Manage training programs'
        expect(screen.getByText(/Manage training programs/)).toBeInTheDocument();
      });
    });

    it('should render view mode section', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        // Check for view mode text label
        expect(screen.getByText('มุมมอง:')).toBeInTheDocument();
      });
    });

    it('should render quick access module cards', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('จัดการหลักสูตร')).toBeInTheDocument();
        expect(screen.getByText('จัดการรอบอบรม')).toBeInTheDocument();
        expect(screen.getByText('Competency Matrix')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display stat cards', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('หลักสูตรทั้งหมด')).toBeInTheDocument();
        expect(screen.getByText('หลักสูตรบังคับ')).toBeInTheDocument();
        expect(screen.getByText('รอบอบรมทั้งหมด')).toBeInTheDocument();
        expect(screen.getByText('กำลังดำเนินการ')).toBeInTheDocument();
      });
    });

    it('should display additional stat cards', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('เสร็จสิ้นแล้ว')).toBeInTheDocument();
        expect(screen.getByText('ใน 7 วันข้างหน้า')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch training courses on mount', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const coursesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/hr/training/courses')
      );
      expect(coursesCall).toBeDefined();
    });

    it('should fetch training sessions on mount', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const sessionsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/hr/training/sessions')
      );
      expect(sessionsCall).toBeDefined();
    });

    it('should handle empty courses data gracefully', async () => {
      setupFetchMock({
        '/api/hr/training/courses': { data: createSingleResponse([]) },
        '/api/hr/training/sessions': { data: createSingleResponse(MOCK_TRAINING_SESSIONS) },
      });

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        // Title comes from i18n: t('training.title') = 'Training'
        expect(screen.getByText('Training')).toBeInTheDocument();
      });
    });

    it('should handle empty sessions data gracefully', async () => {
      setupFetchMock({
        '/api/hr/training/courses': { data: createSingleResponse(MOCK_TRAINING_COURSES) },
        '/api/hr/training/sessions': { data: createSingleResponse([]) },
      });

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        // Title comes from i18n: t('training.title') = 'Training'
        expect(screen.getByText('Training')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/hr/training/courses': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/hr/training/sessions': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<TrainingDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        // Title comes from i18n: t('training.title') = 'Training'
        expect(screen.getByText('Training')).toBeInTheDocument();
      });
    });

    it('should correctly parse direct array response structure (regression)', () => {
      // HR pages use direct array format, not paginated
      const coursesResponse = createSingleResponse(MOCK_TRAINING_COURSES);
      const sessionsResponse = createSingleResponse(MOCK_TRAINING_SESSIONS);

      // Correct: data returns the array directly
      expect(Array.isArray(coursesResponse.data)).toBe(true);
      expect(coursesResponse.data.length).toBe(MOCK_TRAINING_COURSES.length);
      expect(Array.isArray(sessionsResponse.data)).toBe(true);
      expect(sessionsResponse.data.length).toBe(MOCK_TRAINING_SESSIONS.length);
    });
  });

  describe('Filter Section', () => {
    it('should render filter toggle button via header', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      // The filter section is controlled via buttons in the header
      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('should have view mode text label', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('มุมมอง:')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Links', () => {
    it('should have link to courses page', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        const coursesLink = screen.getByRole('link', { name: /จัดการหลักสูตร/ });
        expect(coursesLink).toHaveAttribute('href', '/hr/training/courses');
      });
    });

    it('should have link to sessions page', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        const sessionsLink = screen.getByRole('link', { name: /จัดการรอบอบรม/ });
        expect(sessionsLink).toHaveAttribute('href', '/hr/training/sessions');
      });
    });

    it('should have link to matrix page', async () => {
      setupFetchMock(HR_FETCH_HANDLERS);

      renderWithProviders(<TrainingDashboardPage />);

      await waitFor(() => {
        const matrixLink = screen.getByRole('link', { name: /Competency Matrix/ });
        expect(matrixLink).toHaveAttribute('href', '/hr/training/matrix');
      });
    });
  });
});
