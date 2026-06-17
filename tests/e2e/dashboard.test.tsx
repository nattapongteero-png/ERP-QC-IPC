/**
 * E2E Tests for Dashboard Page
 * Feature: Multi-Module KPIs Dashboard
 *
 * Tests the main dashboard with:
 * - Primary KPIs (Total Items, Active Work Orders, Open Deviations, Expiring Soon)
 * - Secondary Stats (Quarantine, Pending POs/SOs, Monthly Growth)
 * - Module KPI Tabs (HR, Purchasing, Sales, VMI, GMP Compliance)
 * - HR Module KPIs (Total Employees, Training Compliance)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock DevExtreme TabPanel
vi.mock('devextreme-react/tab-panel', () => ({
  default: ({ items, itemTitleRender, itemRender }: any) => (
    <div data-testid="tab-panel">
      <div className="tabs">
        {items.map((item: any, index: number) => (
          <div key={index} className="tab">
            {itemTitleRender(item)}
          </div>
        ))}
      </div>
      <div className="tab-content">
        {items.map((item: any, index: number) => (
          <div key={index}>{itemRender(item)}</div>
        ))}
      </div>
    </div>
  ),
}));

// Mock lucide-react icons.
// Use a Proxy so ANY icon name resolves to a stub component. This prevents
// "No <Icon> export is defined on the lucide-react mock" errors when the page
// imports a new icon that wasn't explicitly listed here.
vi.mock('lucide-react', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name }
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    }
  );
});

// Mock dashboard response data
const mockDashboardResponse = {
  success: true,
  data: {
    summary: {
      totalItems: 100,
      lotsInQuarantine: 5,
      lotsExpiringSoon: 10,
      activeWorkOrders: 8,
      pendingPOs: 12,
      pendingSOs: 6,
      openDeviations: 3,
    },
    recentWorkOrders: [
      {
        id: 1,
        woNumber: 'WO-2025-001',
        batchNumber: 'BATCH-001',
        status: 'in_progress',
        plannedQuantity: 1000,
        unit: 'tablets',
      },
      {
        id: 2,
        woNumber: 'WO-2025-002',
        batchNumber: 'BATCH-002',
        status: 'planned',
        plannedQuantity: 500,
        unit: 'capsules',
      },
    ],
    inventoryByStatus: [
      { status: 'released', count: 50, totalQuantity: 10000 },
      { status: 'quarantine', count: 5, totalQuantity: 500 },
    ],
    workOrdersByStatus: [
      { status: 'in_progress', count: 8 },
      { status: 'completed', count: 25 },
    ],
    inventoryByWarehouseType: [
      {
        warehouseType: 'raw_material',
        warehouseName: 'RM Warehouse A',
        lotCount: 30,
        totalQuantity: 5000,
      },
      {
        warehouseType: 'finished_goods',
        warehouseName: 'FG Warehouse B',
        lotCount: 20,
        totalQuantity: 3000,
      },
    ],
    moduleKpis: {
      hr: {
        totalEmployees: 50,
        activeEmployees: 45,
        trainingCompliance: 85,
        healthRecordsDue: 3,
        gmpAuthorized: 20,
        pendingNotifications: 5,
      },
      purchase: {
        pendingPOs: 12,
        approvedPOs: 25,
        poValueMtd: 500000,
        activeVendors: 15,
        onTimeDeliveryRate: 92,
        avlCoverage: 75,
      },
      sales: {
        pendingSOs: 6,
        soValueMtd: 750000,
        ordersFulfilledMtd: 42,
        atpShortages: 2,
        fulfillmentRate: 88,
      },
      vmi: {
        vmiItems: 30,
        lastSyncTime: '2025-12-25T10:00:00Z',
        stockBelowReorder: 5,
        pendingAsns: 3,
        outstandingOrderValue: 150000,
      },
      gmp: {
        overallScore: 92,
        openDeviations: 3,
        openCapas: 1,
        openAuditFindings: 3,
        trainingGaps: 4,
      },
      generatedAt: '2025-12-25T12:00:00Z',
    },
  },
};

// Import the page component after mocks are set up
import DashboardPage from '@/app/dashboard/page';

describe('Dashboard Page E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockDashboardResponse),
      } as Response)
    );
  });

  describe('Page Header', () => {
    it('should render the page header with correct title', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });

    it('should render the Thai description', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Overview of the Herbal Medicine Manufacturing System')).toBeInTheDocument();
      });
    });
  });

  describe('Primary KPIs', () => {
    it('should display Total Items KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Items')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('Active inventory items')).toBeInTheDocument();
      });
    });

    it('should display Active Work Orders KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Active Work Orders')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('Currently in production')).toBeInTheDocument();
      });
    });

    it('should display Open Deviations KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const openDeviations = screen.getAllByText('Open Deviations');
        expect(openDeviations.length).toBeGreaterThan(0);
        expect(screen.getByText('Requires attention')).toBeInTheDocument();
      });
    });

    it('should display Expiring Soon KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('Within 30 days')).toBeInTheDocument();
      });
    });
  });

  describe('Secondary Stats', () => {
    it('should display Lots in Quarantine stat', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Lots in Quarantine')).toBeInTheDocument();
        const fiveElements = screen.getAllByText('5');
        expect(fiveElements.length).toBeGreaterThan(0);
      });
    });

    it('should display Pending POs stat', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const pendingPOs = screen.getAllByText(/Pending POs/i);
        expect(pendingPOs.length).toBeGreaterThan(0);
        const twelveElements = screen.getAllByText('12');
        expect(twelveElements.length).toBeGreaterThan(0);
      });
    });

    it('should display Pending SOs stat', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Pending SOs')).toBeInTheDocument();
        const sixElements = screen.getAllByText('6');
        expect(sixElements.length).toBeGreaterThan(0);
      });
    });

    it('should display Monthly Growth stat', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Monthly Growth')).toBeInTheDocument();
        expect(screen.getByText('+8.5%')).toBeInTheDocument();
      });
    });
  });

  describe('Module KPI Tabs', () => {
    it('should display the Module KPIs card title', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        // Global next-intl mock (tests/setup.ts) resolves the EN locale, so the
        // card renders cardTitle + cardDescription from src/locales/en/dashboard.json.
        expect(screen.getAllByText('Module KPIs').length).toBeGreaterThan(0);
        expect(
          screen.getByText('Performance indicators broken down by module')
        ).toBeInTheDocument();
      });
    });

    it('should render all module tabs', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('HR / Personnel')).toBeInTheDocument();
        expect(screen.getByText('Purchasing')).toBeInTheDocument();
        expect(screen.getByText('Sales')).toBeInTheDocument();
        expect(screen.getByText('VMI')).toBeInTheDocument();
        expect(screen.getByText('GMP Compliance')).toBeInTheDocument();
      });
    });
  });

  describe('HR Module KPIs', () => {
    it('should display Total Employees KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Employees')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('45 active')).toBeInTheDocument();
      });
    });

    it('should display Training Compliance KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Training Compliance')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('Up-to-date training')).toBeInTheDocument();
      });
    });

    it('should display Health Records Due KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Health Records Due')).toBeInTheDocument();
        const threeElements = screen.getAllByText('3');
        expect(threeElements.length).toBeGreaterThan(0);
        expect(screen.getByText('Overdue examinations')).toBeInTheDocument();
      });
    });

    it('should display GMP Authorized KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('GMP Authorized')).toBeInTheDocument();
        const twentyElements = screen.getAllByText('20');
        expect(twentyElements.length).toBeGreaterThan(0);
        expect(screen.getByText('Active authorizations')).toBeInTheDocument();
      });
    });
  });

  describe('Purchasing Module KPIs', () => {
    it('should display Pending POs KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const pendingPOs = screen.getAllByText(/Pending POs/i);
        expect(pendingPOs.length).toBeGreaterThan(0);
      });
    });

    it('should display Active Vendors KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Active Vendors')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    it('should display AVL Coverage KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('AVL Coverage')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });
  });

  describe('Sales Module KPIs', () => {
    it('should display Pending Orders KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Pending Orders')).toBeInTheDocument();
        expect(screen.getByText('Awaiting processing')).toBeInTheDocument();
      });
    });

    it('should display Orders Fulfilled KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Orders Fulfilled')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
      });
    });

    it('should display Fulfillment Rate KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Fulfillment Rate')).toBeInTheDocument();
        expect(screen.getByText('88%')).toBeInTheDocument();
      });
    });
  });

  describe('VMI Module KPIs', () => {
    it('should display VMI Items KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('VMI Items')).toBeInTheDocument();
        const thirtyElements = screen.getAllByText('30');
        expect(thirtyElements.length).toBeGreaterThan(0);
      });
    });

    it('should display Below Reorder KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Below Reorder')).toBeInTheDocument();
        expect(screen.getByText('Need replenishment')).toBeInTheDocument();
      });
    });

    it('should display Pending ASNs KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Pending ASNs')).toBeInTheDocument();
        expect(screen.getByText('Awaiting receipt')).toBeInTheDocument();
      });
    });
  });

  describe('GMP Compliance Module KPIs', () => {
    it('should display Compliance Score KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Compliance Score')).toBeInTheDocument();
        const scoreElements = screen.getAllByText('92%');
        expect(scoreElements.length).toBeGreaterThan(0);
        expect(screen.getByText('Overall GMP compliance')).toBeInTheDocument();
      });
    });

    it('should display Open Deviations from GMP module', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const openDeviations = screen.getAllByText(/Open Deviations/i);
        expect(openDeviations.length).toBeGreaterThan(0);
      });
    });

    it('should display Open CAPAs KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Open CAPAs')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should display Audit Findings KPI', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Audit Findings')).toBeInTheDocument();
        expect(screen.getByText('Open findings')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Work Orders Section', () => {
    it('should render Recent Work Orders card', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Recent Work Orders')).toBeInTheDocument();
      });
    });

    it('should display work order details', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('WO-2025-001')).toBeInTheDocument();
        expect(screen.getByText('Batch: BATCH-001')).toBeInTheDocument();
        expect(screen.getByText('1,000 tablets')).toBeInTheDocument();
      });
    });
  });

  describe('Inventory by Status Section', () => {
    it('should render Inventory by Status card', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory by Status')).toBeInTheDocument();
      });
    });

    it('should display inventory status details', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('50 lots')).toBeInTheDocument();
      });
    });
  });

  describe('Inventory by Warehouse Type Section', () => {
    it('should render Inventory by Warehouse Type card', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Warehouse Overview')).toBeInTheDocument();
      });
    });

    it('should display warehouse details', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('RM Warehouse A')).toBeInTheDocument();
        expect(screen.getByText('FG Warehouse B')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading skeletons when loading', async () => {
      // Mock fetch to delay - never resolves to keep loading state
      global.fetch = vi.fn(() => new Promise<Response>(() => {}));

      const { container } = render(<DashboardPage />);

      // Should show multiple skeleton loaders - check for skeleton classes or specific loading elements
      // The skeletons use specific className patterns
      const hasLoadingState = container.querySelector('[class*="animate-pulse"]') !== null ||
                               container.querySelector('[class*="skeleton"]') !== null ||
                               container.textContent?.includes('Loading') !== false;

      expect(hasLoadingState).toBeTruthy();
    });
  });

  describe('API Integration', () => {
    it('should fetch data from /api/dashboard endpoint', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/dashboard');
      });
    });

    it('should handle successful API response', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument(); // Total Items
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn(() => Promise.reject(new Error('API Error')));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Data Formatting', () => {
    it('should format numbers with locale string', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('1,000 tablets')).toBeInTheDocument();
      });
    });

    it('should format quantities correctly', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        // Check that quantities are formatted with commas
        const quantityElements = screen.getAllByText(/\d+,\d+/);
        expect(quantityElements.length).toBeGreaterThan(0);
      });
    });
  });
});
