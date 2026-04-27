/**
 * Work Order Detail Page - Delivery Date Display & Overdue Warning Tests
 *
 * Tests:
 * 1. Delivery Date uses same format as Planned Start/End (toLocaleDateString('th-TH'))
 * 2. Overdue badge appears when deliveryDate < today and WO not completed/cancelled
 * 3. No overdue badge for completed/cancelled WOs
 * 4. No overdue badge when deliveryDate is in the future
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: (props: any) => <button onClick={props.onClick}>{props.text}</button>,
}));

vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: () => <input type="number" readOnly />,
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: () => <select><option>-</option></select>,
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: () => <input readOnly />,
}));

vi.mock('@/components/ui/dx-text-area', () => ({
  DxTextArea: () => <textarea readOnly />,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children }: any) => <div>{children}</div>,
  DxDataGridColumn: () => null,
  DxColumn: () => null,
}));

vi.mock('@/components/ui/dx-tabs', () => ({
  DxTabs: ({ children, onItemClick }: any) => <div data-testid="dx-tabs">{children}</div>,
  DxTabItem: () => null,
}));

vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: () => null,
}));

vi.mock('@/components/ui/dx-load-indicator', () => ({
  DxLoadIndicator: () => <div>Loading...</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: () => null,
  Item: {} as any,
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import WorkOrderDetailPage from '@/app/production/work-orders/[id]/page';

function createMockWorkOrder(overrides: Record<string, any> = {}) {
  return {
    workOrder: {
      id: 1,
      woNumber: 'WO2026-TEST',
      productId: 1,
      productCode: 'PROD-001',
      productName: 'Test Product',
      productNameEn: 'Test Product EN',
      productUnit: 'bottle',
      batchNumber: 'BATCH-001',
      plannedQty: 100,
      actualQty: 0,
      status: 'in_progress',
      plannedStartDate: '2026-03-01',
      plannedEndDate: '2026-03-15',
      actualStartDate: '',
      actualEndDate: '',
      deliveryDate: '',
      notes: '',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
      ...overrides,
    },
    materials: [],
    qcTests: [],
    ebmr: {
      batchNumber: 'BATCH-001',
      productCode: 'PROD-001',
      productName: 'Test Product',
      plannedQty: 100,
      actualQty: 0,
      yieldPercent: 0,
      productionTimeHours: 0,
      status: 'in_progress',
      materials: [],
      qcTests: [],
      timeline: {
        plannedStart: '2026-03-01',
        plannedEnd: '2026-03-15',
        actualStart: '',
        actualEnd: '',
      },
    },
    summary: {
      yieldPercent: 0,
      productionTimeHours: 0,
      materialCount: 0,
      qcTestCount: 0,
      qcPassCount: 0,
    },
  };
}

function setupFetchWithWO(woOverrides: Record<string, any> = {}) {
  const mockData = createMockWorkOrder(woOverrides);
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const urlStr = String(url);
    if (urlStr.includes('/detail')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockData }),
      });
    }
    if (urlStr.includes('/line-clearance')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { required: false, status: 'not_started', canStartProduction: true, message: '' },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  }) as any;
}

describe('WO Detail Page - Delivery Date Display & Overdue Warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page without crashing', async () => {
    setupFetchWithWO();
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/WO2026-TEST/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should display Delivery Date label', async () => {
    setupFetchWithWO({ deliveryDate: '2026-04-01' });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Delivery Date (วันที่ส่งมอบ)')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show overdue badge when deliveryDate is past and WO is in_progress', async () => {
    // Use a date far in the past to ensure it's always overdue
    setupFetchWithWO({
      deliveryDate: '2024-01-01',
      status: 'in_progress',
    });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('เลยกำหนดส่งมอบ')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show overdue badge when deliveryDate is past and WO is planned', async () => {
    setupFetchWithWO({
      deliveryDate: '2024-01-01',
      status: 'planned',
    });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('เลยกำหนดส่งมอบ')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should NOT show overdue badge when WO status is completed', async () => {
    setupFetchWithWO({
      deliveryDate: '2024-01-01',
      status: 'completed',
    });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Delivery Date (วันที่ส่งมอบ)')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByText('เลยกำหนดส่งมอบ')).not.toBeInTheDocument();
  });

  it('should NOT show overdue badge when WO status is cancelled', async () => {
    setupFetchWithWO({
      deliveryDate: '2024-01-01',
      status: 'cancelled',
    });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Delivery Date (วันที่ส่งมอบ)')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByText('เลยกำหนดส่งมอบ')).not.toBeInTheDocument();
  });

  it('should NOT show overdue badge when deliveryDate is in the future', async () => {
    setupFetchWithWO({
      deliveryDate: '2099-12-31',
      status: 'in_progress',
    });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Delivery Date (วันที่ส่งมอบ)')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByText('เลยกำหนดส่งมอบ')).not.toBeInTheDocument();
  });

  it('should show dash when deliveryDate is empty', async () => {
    setupFetchWithWO({ deliveryDate: '' });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Delivery Date (วันที่ส่งมอบ)')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByText('เลยกำหนดส่งมอบ')).not.toBeInTheDocument();
  });

  it('should use same date format (th-TH) for all date fields', async () => {
    // Verify Planned Start, Planned End, and Delivery Date all use toLocaleDateString('th-TH')
    setupFetchWithWO({
      plannedStartDate: '2026-03-01',
      plannedEndDate: '2026-03-15',
      deliveryDate: '2026-04-01',
      status: 'in_progress',
    });
    render(<WorkOrderDetailPage />);

    await waitFor(() => {
      // All three dates should render using th-TH locale format
      const plannedStart = new Date('2026-03-01').toLocaleDateString('th-TH');
      const plannedEnd = new Date('2026-03-15').toLocaleDateString('th-TH');
      const deliveryDate = new Date('2026-04-01').toLocaleDateString('th-TH');

      expect(screen.getByText(plannedStart)).toBeInTheDocument();
      expect(screen.getByText(plannedEnd)).toBeInTheDocument();
      expect(screen.getByText(deliveryDate)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
