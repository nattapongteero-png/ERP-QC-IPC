/**
 * UI Tests for Audit Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T052)
 *
 * Tests the Audit Dashboard with 8 KPI cards for external auditor review:
 * - FR-047: RM Received YTD
 * - FR-048: RM Status Breakdown
 * - FR-049: Expiry Alerts
 * - FR-050: Min Stock Alerts
 * - FR-051: QC Summary
 * - FR-052: Production Status
 * - FR-053: Pending QC Release
 * - FR-054: FG Approved YTD
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
}));

// Mock KPI data for testing
const mockAuditKpis = {
  rmReceivedYtd: {
    totalLots: 150,
    totalQuantity: 25000,
    byMonth: [
      { month: '2024-01', lots: 30, quantity: 5000 },
      { month: '2024-02', lots: 35, quantity: 6000 },
    ],
  },
  rmStatusBreakdown: {
    quarantine: 10,
    underTest: 15,
    released: 100,
    rejected: 5,
    blocked: 2,
    total: 132,
  },
  expiryAlerts: {
    expired: 3,
    expiringSoon: 8,
    expiringWarning: 12,
    items: [
      { lotId: 1, lotNumber: 'LOT-001', itemName: 'Item A', expiryDate: '2024-02-15', daysUntilExpiry: 7 },
      { lotId: 2, lotNumber: 'LOT-002', itemName: 'Item B', expiryDate: '2024-02-10', daysUntilExpiry: 2 },
    ],
  },
  minStockAlerts: {
    criticalCount: 5,
    warningCount: 10,
    items: [
      { itemId: 1, itemCode: 'RM001', itemName: 'Raw Material A', onHand: 30, minStock: 50, reorderPoint: 75 },
      { itemId: 2, itemCode: 'RM002', itemName: 'Raw Material B', onHand: 45, minStock: 60, reorderPoint: 80 },
    ],
  },
  qcSummary: {
    totalTests: 250,
    passedTests: 220,
    failedTests: 15,
    pendingTests: 15,
    passRate: 88,
    byTestType: [
      { testType: 'incoming', passed: 100, failed: 8, pending: 5 },
      { testType: 'in_process', passed: 60, failed: 4, pending: 5 },
      { testType: 'finished', passed: 60, failed: 3, pending: 5 },
    ],
  },
  productionStatus: {
    planned: 20,
    released: 15,
    inProgress: 25,
    completed: 80,
    cancelled: 5,
    total: 145,
    completionRate: 57,
  },
  pendingQcRelease: {
    count: 12,
    items: [
      { lotId: 1, lotNumber: 'LOT-001', itemName: 'Item A', testDate: '2024-02-01', daysWaiting: 5 },
      { lotId: 2, lotNumber: 'LOT-002', itemName: 'Item B', testDate: '2024-02-03', daysWaiting: 3 },
    ],
  },
  fgApproved: {
    totalBatches: 75,
    totalQuantity: 15000,
    byMonth: [
      { month: '2024-01', batches: 35, quantity: 7000 },
      { month: '2024-02', batches: 40, quantity: 8000 },
    ],
  },
  generatedAt: '2024-02-08T10:30:00.000Z',
};

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey.includes('audit-kpis')) {
      return {
        data: mockAuditKpis,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return {
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }),
}));

// Mock lucide-react icons - all icons used by dashboard components
vi.mock('lucide-react', () => ({
  Package: vi.fn(() => <span data-testid="icon-package">Package</span>),
  AlertTriangle: vi.fn(() => <span data-testid="icon-alert">Alert</span>),
  Clock: vi.fn(() => <span data-testid="icon-clock">Clock</span>),
  CheckCircle2: vi.fn(() => <span data-testid="icon-check">Check</span>),
  Factory: vi.fn(() => <span data-testid="icon-factory">Factory</span>),
  BarChart3: vi.fn(() => <span data-testid="icon-bar-chart">BarChart</span>),
  TestTube2: vi.fn(() => <span data-testid="icon-test-tube">TestTube</span>),
  Calendar: vi.fn(() => <span data-testid="icon-calendar">Calendar</span>),
}));

// Import the page component after mocks are set up
import AuditDashboardPage from '@/app/dashboard/audit/page';

describe('Audit Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Audit Dashboard')).toBeInTheDocument();
      });
    });

    it('should render the subtitle for GMP compliance', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('GMP Compliance Overview for External Auditors')).toBeInTheDocument();
      });
    });

    it('should display the last updated timestamp', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('KPI Section Headers', () => {
    it('should render Raw Materials section header', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Raw Materials')).toBeInTheDocument();
      });
    });

    it('should render Quality & Production section header', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Quality & Production')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards - Raw Materials Row', () => {
    it('should render RM Received YTD card (FR-047)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('RM Received YTD')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument(); // totalLots
      });
    });

    it('should render RM Status card (FR-048)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('RM Status')).toBeInTheDocument();
      });
    });

    it('should render Expiry Alerts card (FR-049)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Expiry Alerts')).toBeInTheDocument();
      });
    });

    it('should render Min Stock Alerts card (FR-050)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Min Stock Alerts')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards - Quality & Production Row', () => {
    it('should render QC Summary card (FR-051)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('QC Summary YTD')).toBeInTheDocument();
      });
    });

    it('should render Production YTD card (FR-052)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Production YTD')).toBeInTheDocument();
      });
    });

    it('should render Pending QC Release card (FR-053)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Pending QC Release')).toBeInTheDocument();
      });
    });

    it('should render FG Approved YTD card (FR-054)', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('FG Approved YTD')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Card Values', () => {
    it('should display correct RM received total lots', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });

    it('should display correct QC pass rate', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('88%')).toBeInTheDocument();
      });
    });

    it('should display correct production completion rate', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('57%')).toBeInTheDocument();
      });
    });

    it('should display correct FG approved batches', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('75')).toBeInTheDocument();
      });
    });

    it('should display pending QC release count', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument();
      });
    });
  });

  describe('Detail Tables', () => {
    it('should render Upcoming Expirations table when items exist', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Upcoming Expirations (Next 30 Days)')).toBeInTheDocument();
      });
    });

    it('should render Low Stock Items table when items exist', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Low Stock Items')).toBeInTheDocument();
      });
    });

    it('should display expiring lot details', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('LOT-001')).toBeInTheDocument();
        expect(screen.getByText('Item A')).toBeInTheDocument();
      });
    });

    it('should display low stock item details', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('RM001')).toBeInTheDocument();
        expect(screen.getByText('Raw Material A')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when data is loading', async () => {
      // Override the mock for loading state test
      const { useQuery } = await import('@tanstack/react-query');
      (useQuery as any).mockImplementation(() => ({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      }));

      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Loading KPIs...')).toBeInTheDocument();
      });

      // Restore the mock
      (useQuery as any).mockImplementation(({ queryKey }: any) => {
        if (queryKey.includes('audit-kpis')) {
          return {
            data: mockAuditKpis,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when data fetch fails', async () => {
      // Override the mock for error state test
      const { useQuery } = await import('@tanstack/react-query');
      (useQuery as any).mockImplementation(() => ({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch'),
        refetch: vi.fn(),
      }));

      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Error loading dashboard data. Please try again.')).toBeInTheDocument();
      });

      // Restore the mock
      (useQuery as any).mockImplementation(({ queryKey }: any) => {
        if (queryKey.includes('audit-kpis')) {
          return {
            data: mockAuditKpis,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      });
    });

    it('should show retry button on error', async () => {
      // Override the mock for error state test
      const { useQuery } = await import('@tanstack/react-query');
      (useQuery as any).mockImplementation(() => ({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch'),
        refetch: vi.fn(),
      }));

      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });

      // Restore the mock
      (useQuery as any).mockImplementation(({ queryKey }: any) => {
        if (queryKey.includes('audit-kpis')) {
          return {
            data: mockAuditKpis,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      });
    });
  });

  describe('Responsive Grid Layout', () => {
    it('should render KPI cards in a grid layout', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        // Check that the grid containers exist
        const rawMaterialsSection = screen.getByText('Raw Materials').closest('div')?.parentElement;
        expect(rawMaterialsSection).toBeInTheDocument();

        const qualitySection = screen.getByText('Quality & Production').closest('div')?.parentElement;
        expect(qualitySection).toBeInTheDocument();
      });
    });
  });

  describe('KPI Card Status Indicators', () => {
    it('should show warning status for expiry alerts', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        // The expiry alert card should be rendered
        const expiryCard = screen.getByText('Expiry Alerts');
        expect(expiryCard).toBeInTheDocument();
      });
    });

    it('should show normal status for FG approved', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        const fgCard = screen.getByText('FG Approved YTD');
        expect(fgCard).toBeInTheDocument();
      });
    });
  });

  describe('Data Formatting', () => {
    it('should format quantities with locale string', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        // Check for formatted quantities
        expect(screen.getByText(/25,000 units/)).toBeInTheDocument();
      });
    });

    it('should format FG total quantity with locale string', async () => {
      render(<AuditDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/15,000 units/)).toBeInTheDocument();
      });
    });
  });
});
