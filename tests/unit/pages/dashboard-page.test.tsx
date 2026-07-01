/**
 * Dashboard Page Unit Tests with i18n
 * Feature: 015-i18n (T029)
 *
 * Tests that the dashboard page renders correctly with translations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Restore real next-intl (global mock in setup.ts overrides useTranslations)
vi.unmock('next-intl');

import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the MainLayout component
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock the ModuleKpiTabs component
vi.mock('@/components/dashboard/module-kpi-tabs', () => ({
  ModuleKpiTabs: ({ data, isLoading }: { data: unknown; isLoading: boolean }) => (
    <div data-testid="module-kpi-tabs">
      {isLoading ? 'Loading KPIs...' : 'Module KPIs'}
    </div>
  ),
}));

// Import after mocks
import DashboardPage from '@/app/dashboard/page';

// Mock dashboard messages
const mockDashboardMessages = {
  title: 'Dashboard',
  description: 'Overview of the Herbal Medicine Manufacturing System',
  kpis: {
    totalItems: {
      label: 'Total Items',
      subtitle: 'Active inventory items',
    },
    activeWorkOrders: {
      label: 'Active Work Orders',
      subtitle: 'Currently in production',
    },
    openDeviations: {
      label: 'Open Deviations',
      subtitle: 'Requires attention',
      actionNeeded: 'Action needed',
      allClear: 'All clear',
    },
    expiringSoon: {
      label: 'Expiring Soon',
      subtitle: 'Within 30 days',
      monitorClosely: 'Monitor closely',
      lowRisk: 'Low risk',
    },
    lotsInQuarantine: {
      label: 'Lots in Quarantine',
      subtitle: 'Awaiting QC inspection',
    },
    pendingPOs: {
      label: 'Pending POs',
      subtitle: 'Awaiting approval or delivery',
    },
    pendingSOs: {
      label: 'Pending SOs',
      subtitle: 'Awaiting processing',
    },
    monthlyGrowth: {
      label: 'Monthly Growth',
    },
    trend: {
      up: 'Increase',
      down: 'Decrease',
      neutral: 'No change',
    },
  },
  sections: {
    recentWorkOrders: {
      title: 'Recent Work Orders',
      emptyMessage: 'No recent work orders',
      batchPrefix: 'Batch',
      columns: {
        woNumber: 'WO Number',
        batchNumber: 'Batch Number',
        status: 'Status',
        quantity: 'Quantity',
      },
    },
    inventoryByStatus: {
      title: 'Inventory by Status',
      emptyMessage: 'No inventory data',
      lotsUnit: 'lots',
      totalPrefix: 'Total',
    },
    workOrdersByStatus: {
      title: 'Work Orders by Status',
      emptyMessage: 'No work order data',
    },
    warehouseOverview: {
      title: 'Warehouse Overview',
      emptyMessage: 'No warehouse data',
      emptyDescription: 'Warehouse inventory will appear here once warehouses are set up',
      lotsLabel: 'Lots',
      totalQtyLabel: 'Total Qty',
    },
  },
  warehouseTypes: {
    rawMaterial: 'Raw Material',
    wip: 'Work in Progress',
    finishedGoods: 'Finished Goods',
    quarantine: 'Quarantine',
    rejected: 'Rejected',
    coldStorage: 'Cold Storage',
  },
  moduleKpis: {
    title: 'Module KPIs',
    tabs: {
      inventory: 'Inventory',
      production: 'Production',
      quality: 'Quality',
      purchasing: 'Purchasing',
      sales: 'Sales',
    },
  },
};

// Thai translations for language switching tests
const mockDashboardMessagesTh = {
  title: 'แดชบอร์ด',
  description: 'ภาพรวมระบบบริหารจัดการการผลิตยาสมุนไพร',
  kpis: {
    totalItems: {
      label: 'รายการทั้งหมด',
      subtitle: 'รายการสินค้าคงคลังที่ใช้งานอยู่',
    },
    activeWorkOrders: {
      label: 'ใบสั่งผลิตที่กำลังดำเนินการ',
      subtitle: 'อยู่ระหว่างการผลิต',
    },
    openDeviations: {
      label: 'ความเบี่ยงเบนที่เปิดอยู่',
      subtitle: 'ต้องดำเนินการ',
      actionNeeded: 'ต้องดำเนินการ',
      allClear: 'ปกติ',
    },
    expiringSoon: {
      label: 'ใกล้หมดอายุ',
      subtitle: 'ภายใน 30 วัน',
      monitorClosely: 'ต้องติดตามใกล้ชิด',
      lowRisk: 'ความเสี่ยงต่ำ',
    },
    lotsInQuarantine: {
      label: 'ล็อตในกักกัน',
      subtitle: 'รอการตรวจสอบ QC',
    },
    pendingPOs: {
      label: 'ใบสั่งซื้อที่รอดำเนินการ',
      subtitle: 'รอการอนุมัติหรือจัดส่ง',
    },
    pendingSOs: {
      label: 'ใบสั่งขายที่รอดำเนินการ',
      subtitle: 'รอดำเนินการ',
    },
    monthlyGrowth: {
      label: 'การเติบโตรายเดือน',
    },
    trend: {
      up: 'เพิ่มขึ้น',
      down: 'ลดลง',
      neutral: 'คงที่',
    },
  },
  sections: {
    recentWorkOrders: {
      title: 'ใบสั่งผลิตล่าสุด',
      emptyMessage: 'ไม่มีใบสั่งผลิตล่าสุด',
      batchPrefix: 'แบตช์',
      columns: {
        woNumber: 'เลขที่ใบสั่งผลิต',
        batchNumber: 'เลขที่แบตช์',
        status: 'สถานะ',
        quantity: 'ปริมาณ',
      },
    },
    inventoryByStatus: {
      title: 'สินค้าคงคลังตามสถานะ',
      emptyMessage: 'ไม่มีข้อมูลสินค้าคงคลัง',
      lotsUnit: 'ล็อต',
      totalPrefix: 'รวม',
    },
    workOrdersByStatus: {
      title: 'ใบสั่งผลิตตามสถานะ',
      emptyMessage: 'ไม่มีข้อมูลใบสั่งผลิต',
    },
    warehouseOverview: {
      title: 'ภาพรวมคลังสินค้า',
      emptyMessage: 'ไม่มีข้อมูลคลังสินค้า',
      emptyDescription: 'ข้อมูลสินค้าคงคลังในคลังสินค้าจะปรากฏเมื่อมีการตั้งค่าคลังสินค้าแล้ว',
      lotsLabel: 'ล็อต',
      totalQtyLabel: 'จำนวนรวม',
    },
  },
  warehouseTypes: {
    rawMaterial: 'วัตถุดิบ',
    wip: 'งานระหว่างทำ',
    finishedGoods: 'สินค้าสำเร็จรูป',
    quarantine: 'กักกัน',
    rejected: 'ถูกปฏิเสธ',
    coldStorage: 'ห้องเย็น',
  },
  moduleKpis: {
    title: 'ตัวชี้วัดแยกตามโมดูล',
    tabs: {
      inventory: 'คลังสินค้า',
      production: 'การผลิต',
      quality: 'คุณภาพ',
      purchasing: 'จัดซื้อ',
      sales: 'ขาย',
    },
  },
};

// Mock API response data
const mockApiResponse = {
  success: true,
  data: {
    summary: {
      totalItems: 150,
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
        woNumber: 'WO-2024-001',
        batchNumber: 'BATCH-001',
        status: 'in_progress',
        plannedQuantity: 1000,
        unit: 'kg',
      },
    ],
    inventoryByStatus: [
      { status: 'available', count: 100, totalQuantity: 50000 },
      { status: 'quarantine', count: 5, totalQuantity: 2500 },
    ],
    workOrdersByStatus: [
      { status: 'in_progress', count: 8 },
      { status: 'completed', count: 25 },
    ],
    inventoryByWarehouseType: [
      {
        warehouseType: 'raw_material',
        warehouseName: 'Main Warehouse',
        lotCount: 50,
        totalQuantity: 25000,
      },
      {
        warehouseType: 'finished_goods',
        warehouseName: 'FG Warehouse',
        lotCount: 30,
        totalQuantity: 15000,
      },
    ],
    moduleKpis: null,
  },
};

// Empty API response
const mockEmptyApiResponse = {
  success: true,
  data: {
    summary: {
      totalItems: 0,
      lotsInQuarantine: 0,
      lotsExpiringSoon: 0,
      activeWorkOrders: 0,
      pendingPOs: 0,
      pendingSOs: 0,
      openDeviations: 0,
    },
    recentWorkOrders: [],
    inventoryByStatus: [],
    workOrdersByStatus: [],
    inventoryByWarehouseType: [],
    moduleKpis: null,
  },
};

function renderDashboard(locale: 'en' | 'th' = 'en', apiResponse = mockApiResponse) {
  // Mock fetch
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(apiResponse),
  });

  const messages = locale === 'en' ? mockDashboardMessages : mockDashboardMessagesTh;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale={locale}
        messages={{ dashboard: messages }}
        timeZone="Asia/Bangkok"
      >
        <DashboardPage />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('DashboardPage with i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('English locale', () => {
    it('renders page header with English translations', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(
          screen.getByText('Overview of the Herbal Medicine Manufacturing System')
        ).toBeInTheDocument();
      });
    });

    it('renders KPI cards with English labels', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText('Total Items')).toBeInTheDocument();
        expect(screen.getByText('Active Work Orders')).toBeInTheDocument();
        expect(screen.getByText('Open Deviations')).toBeInTheDocument();
        expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
      });
    });

    it('renders stat cards with English labels', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText('Lots in Quarantine')).toBeInTheDocument();
        expect(screen.getByText('Pending POs')).toBeInTheDocument();
        expect(screen.getByText('Pending SOs')).toBeInTheDocument();
        expect(screen.getByText('Monthly Growth')).toBeInTheDocument();
      });
    });

    it('renders section titles in English', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText('Recent Work Orders')).toBeInTheDocument();
        expect(screen.getByText('Inventory by Status')).toBeInTheDocument();
        expect(screen.getByText('Warehouse Overview')).toBeInTheDocument();
      });
    });

    it('renders warehouse type labels in English', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText('Raw Material')).toBeInTheDocument();
        expect(screen.getByText('Finished Goods')).toBeInTheDocument();
      });
    });

    it('renders work order batch prefix in English', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText(/Batch: BATCH-001/)).toBeInTheDocument();
      });
    });

    it('renders inventory count with English unit', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getByText('100 lots')).toBeInTheDocument();
      });
    });

    it('renders warehouse column labels in English', async () => {
      renderDashboard('en');

      await waitFor(() => {
        expect(screen.getAllByText('Lots').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Total Qty').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Thai locale', () => {
    it('renders page header with Thai translations', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText('แดชบอร์ด')).toBeInTheDocument();
        expect(
          screen.getByText('ภาพรวมระบบบริหารจัดการการผลิตยาสมุนไพร')
        ).toBeInTheDocument();
      });
    });

    it('renders KPI cards with Thai labels', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
        expect(screen.getByText('ใบสั่งผลิตที่กำลังดำเนินการ')).toBeInTheDocument();
        expect(screen.getByText('ความเบี่ยงเบนที่เปิดอยู่')).toBeInTheDocument();
        expect(screen.getByText('ใกล้หมดอายุ')).toBeInTheDocument();
      });
    });

    it('renders stat cards with Thai labels', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText('ล็อตในกักกัน')).toBeInTheDocument();
        expect(screen.getByText('ใบสั่งซื้อที่รอดำเนินการ')).toBeInTheDocument();
        expect(screen.getByText('ใบสั่งขายที่รอดำเนินการ')).toBeInTheDocument();
        // Monthly-growth card was removed from the dashboard (misleading
        // negative % when the current month's sales lag last month's).
        expect(screen.queryByText('การเติบโตรายเดือน')).not.toBeInTheDocument();
      });
    });

    it('renders section titles in Thai', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText('ใบสั่งผลิตล่าสุด')).toBeInTheDocument();
        expect(screen.getByText('สินค้าคงคลังตามสถานะ')).toBeInTheDocument();
        expect(screen.getByText('ภาพรวมคลังสินค้า')).toBeInTheDocument();
      });
    });

    it('renders warehouse type labels in Thai', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText('วัตถุดิบ')).toBeInTheDocument();
        expect(screen.getByText('สินค้าสำเร็จรูป')).toBeInTheDocument();
      });
    });

    it('renders work order batch prefix in Thai', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText(/แบตช์: BATCH-001/)).toBeInTheDocument();
      });
    });

    it('renders inventory count with Thai unit', async () => {
      renderDashboard('th');

      await waitFor(() => {
        expect(screen.getByText('100 ล็อต')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state with translations', () => {
    it('renders empty state messages in English', async () => {
      renderDashboard('en', mockEmptyApiResponse);

      await waitFor(() => {
        expect(screen.getByText('No recent work orders')).toBeInTheDocument();
        expect(screen.getByText('No inventory data')).toBeInTheDocument();
        expect(screen.getByText('No warehouse data')).toBeInTheDocument();
        expect(
          screen.getByText('Warehouse inventory will appear here once warehouses are set up')
        ).toBeInTheDocument();
      });
    });

    it('renders empty state messages in Thai', async () => {
      renderDashboard('th', mockEmptyApiResponse);

      await waitFor(() => {
        expect(screen.getByText('ไม่มีใบสั่งผลิตล่าสุด')).toBeInTheDocument();
        expect(screen.getByText('ไม่มีข้อมูลสินค้าคงคลัง')).toBeInTheDocument();
        expect(screen.getByText('ไม่มีข้อมูลคลังสินค้า')).toBeInTheDocument();
        expect(
          screen.getByText('ข้อมูลสินค้าคงคลังในคลังสินค้าจะปรากฏเมื่อมีการตั้งค่าคลังสินค้าแล้ว')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('renders skeleton loader while loading', () => {
      // Mock fetch to not resolve immediately
      global.fetch = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <NextIntlClientProvider
            locale="en"
            messages={{ dashboard: mockDashboardMessages }}
            timeZone="Asia/Bangkok"
          >
            <DashboardPage />
          </NextIntlClientProvider>
        </QueryClientProvider>
      );

      // Should still show the translated title in header
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
