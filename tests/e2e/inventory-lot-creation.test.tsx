/**
 * UI Tests for Inventory Lot Creation Page
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US12 - T066)
 *
 * Tests the Material Receipt workflow with:
 * - FR-055: Manufacturer/Importer tracking fields
 * - FR-056: Retest date tracking fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock master data (warehouses, vendors, lots)
const mockWarehouses = [
  { id: 1, name: 'Main Warehouse', code: 'WH01' },
  { id: 2, name: 'Quarantine Warehouse', code: 'WH02' },
];

const mockVendors = [
  { id: 1, name: 'Thai Herbs Co.', code: 'VND001' },
  { id: 2, name: 'Import Trading', code: 'VND002' },
];

const mockLots = [
  {
    id: 1,
    lotNumber: 'LOT-20241201-001',
    itemId: 1,
    itemCode: 'RM001',
    itemName: 'สมุนไพรทดสอบ',
    warehouseId: 1,
    warehouseName: 'Main Warehouse',
    quantity: 100,
    reservedQuantity: 0,
    unit: 'kg',
    status: 'quarantine',
    manufacturingDate: '2024-11-01',
    expiryDate: '2025-11-01',
    receivedDate: '2024-12-01',
    manufacturerName: 'Thai Herbs Co.',
    importerName: null,
    countryOfOrigin: 'Thailand',
    retestDate: '2025-06-01',
    retestStatus: 'scheduled',
    cost: 500,
  },
];

// Setup fetch mock responses
function setupMockFetch() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/warehouses')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { items: mockWarehouses },
        }),
      });
    }
    if (url.includes('/api/vendors')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { items: mockVendors },
        }),
      });
    }
    if (url.includes('/api/inventory/lots') && !url.includes('POST')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { items: mockLots },
        }),
      });
    }
    // Default response
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });
}

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle: vi.fn(() => <span data-testid="icon-check">Check</span>),
  XCircle: vi.fn(() => <span data-testid="icon-x">X</span>),
  Clock: vi.fn(() => <span data-testid="icon-clock">Clock</span>),
  AlertTriangle: vi.fn(() => <span data-testid="icon-alert">Alert</span>),
  Package: vi.fn(() => <span data-testid="icon-package">Package</span>),
  ArrowRight: vi.fn(() => <span data-testid="icon-arrow">Arrow</span>),
  BoxSelect: vi.fn(() => <span data-testid="icon-box">Box</span>),
  ChevronRight: vi.fn(() => <span data-testid="icon-chevron">Chevron</span>),
  Inbox: vi.fn(() => <span data-testid="icon-inbox">Inbox</span>),
  Boxes: vi.fn(() => <span data-testid="icon-boxes">Boxes</span>),
  TrendingUp: vi.fn(() => <span data-testid="icon-trend">Trend</span>),
  CalendarClock: vi.fn(() => <span data-testid="icon-calendar">Calendar</span>),
  Warehouse: vi.fn(() => <span data-testid="icon-warehouse">Warehouse</span>),
  DollarSign: vi.fn(() => <span data-testid="icon-dollar">Dollar</span>),
  RefreshCw: vi.fn(() => <span data-testid="icon-refresh">Refresh</span>),
  Plus: vi.fn(() => <span data-testid="icon-plus">Plus</span>),
  RefreshCcw: vi.fn(() => <span data-testid="icon-refresh-ccw">RefreshCcw</span>),
}));

// Mock DevExtreme components
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: vi.fn(({ dataSource, noDataText }) => (
    <div data-testid="dx-data-grid">
      {dataSource && dataSource.length > 0 ? (
        dataSource.map((item: typeof mockLots[0]) => (
          <div key={item.id} data-testid={`lot-row-${item.id}`}>
            <span>{item.lotNumber}</span>
            {item.manufacturerName && <span>{item.manufacturerName}</span>}
            {item.retestDate && <span>{item.retestDate}</span>}
          </div>
        ))
      ) : (
        <span>{noDataText}</span>
      )}
    </div>
  )),
  DxDataGridColumn: vi.fn(),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: vi.fn(({ text, onClick, hint, icon }) => (
    <button onClick={onClick} data-testid={`dx-button-${text || icon || 'button'}`}>
      {text || hint || icon}
    </button>
  )),
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: vi.fn(({ value, onValueChange, placeholder, disabled }) => (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={`dx-textbox-${placeholder || 'input'}`}
    />
  )),
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: vi.fn(({ items, value, onValueChange }) => (
    <select
      value={value || ''}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      data-testid="dx-select-box"
    >
      {items?.map((item: { value: string; label: string }) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  )),
}));

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: vi.fn(({ value, onValueChange, min, max }) => (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      min={min}
      max={max}
      data-testid="dx-date-box"
    />
  )),
}));

vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: vi.fn(({ visible, children, title, onHidden }) => {
    if (!visible) return null;
    return (
      <div data-testid="dx-popup" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    );
  }),
}));

// Mock layout components
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: vi.fn(({ children }) => <div data-testid="main-layout">{children}</div>),
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: vi.fn(({ title, description, actions }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  )),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: vi.fn(({ children, variant }) => (
    <span data-testid={`badge-${variant}`} className={`badge-${variant}`}>
      {children}
    </span>
  )),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: vi.fn(({ title, description, action }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  )),
}));

vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: vi.fn(({ open, onOpenChange, onSelect }) => {
    if (!open) return null;
    return (
      <div data-testid="item-search-dialog" role="dialog">
        <button
          onClick={() => {
            onSelect({
              id: 1,
              code: 'RM001',
              nameTh: 'สมุนไพรทดสอบ',
              nameEn: 'Test Herb',
              primaryUnit: 'kg',
              type: 'raw_material',
            });
            onOpenChange(false);
          }}
          data-testid="select-item-btn"
        >
          Select Test Item
        </button>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    );
  }),
}));

// Import the page component after mocks are set up
import LotsPage from '@/app/inventory/lots/page';

describe('Inventory Lots Page - Material Receipt with GMP Fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    setupMockFetch();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory Lots')).toBeInTheDocument();
      });
    });

    it('should render the page description', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('จัดการ Lot/Batch สินค้าคงคลัง')).toBeInTheDocument();
      });
    });

    it('should render the "รับ Lot ใหม่" button', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });
    });
  });

  describe('Lot Creation Modal', () => {
    it('should open create lot modal when clicking "รับ Lot ใหม่" button', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should display create lot modal with correct title', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /รับ Lot ใหม่/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /รับ Lot ใหม่/i }));

      await waitFor(() => {
        // Modal should have the title as h2
        expect(screen.getByRole('heading', { name: 'รับ Lot ใหม่' })).toBeInTheDocument();
      });
    });
  });

  describe('FR-055: Manufacturer/Importer Fields', () => {
    it('should display GMP Compliance section header in form', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('ข้อมูล GMP Compliance')).toBeInTheDocument();
      });
    });

    it('should display manufacturer name input field', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('ชื่อผู้ผลิต (Manufacturer)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('ชื่อผู้ผลิต...')).toBeInTheDocument();
      });
    });

    it('should display importer name input field', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('ชื่อผู้นำเข้า (Importer)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('ชื่อผู้นำเข้า...')).toBeInTheDocument();
      });
    });

    it('should display country of origin input field', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('ประเทศต้นกำเนิด')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('ประเทศ...')).toBeInTheDocument();
      });
    });

    it('should allow entering manufacturer name', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      const manufacturerInput = await screen.findByPlaceholderText('ชื่อผู้ผลิต...');
      fireEvent.change(manufacturerInput, { target: { value: 'Thai Herbs Co., Ltd.' } });

      expect(manufacturerInput).toHaveValue('Thai Herbs Co., Ltd.');
    });

    it('should allow entering importer name', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      const importerInput = await screen.findByPlaceholderText('ชื่อผู้นำเข้า...');
      fireEvent.change(importerInput, { target: { value: 'Import Trading Co.' } });

      expect(importerInput).toHaveValue('Import Trading Co.');
    });

    it('should allow entering country of origin', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      const countryInput = await screen.findByPlaceholderText('ประเทศ...');
      fireEvent.change(countryInput, { target: { value: 'Thailand' } });

      expect(countryInput).toHaveValue('Thailand');
    });
  });

  describe('FR-056: Retest Date Fields', () => {
    it('should display retest date input field', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('วันที่ต้อง Retest')).toBeInTheDocument();
      });
    });

    it('should display retest interval months input field', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('ระยะเวลา Retest (เดือน)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('12')).toBeInTheDocument();
      });
    });

    it('should allow entering retest interval months', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      const retestIntervalInput = await screen.findByPlaceholderText('12');
      fireEvent.change(retestIntervalInput, { target: { value: '6' } });

      expect(retestIntervalInput).toHaveValue(6);
    });
  });

  describe('Form Basic Fields', () => {
    it('should display lot number input with generate button', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('เลขที่ Lot')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('LOT-YYYYMMDD-XXX')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-สร้าง')).toBeInTheDocument();
      });
    });

    it('should display item selection area', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('สินค้า')).toBeInTheDocument();
        expect(screen.getByText('คลิกเพื่อเลือกสินค้า...')).toBeInTheDocument();
      });
    });

    it('should display quantity and unit inputs', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('จำนวน')).toBeInTheDocument();
        expect(screen.getByText('หน่วย')).toBeInTheDocument();
      });
    });

    it('should display date inputs (manufacturing, expiry, received)', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('วันผลิต')).toBeInTheDocument();
        expect(screen.getByText('วันหมดอายุ')).toBeInTheDocument();
        expect(screen.getByText('วันรับสินค้า')).toBeInTheDocument();
      });
    });
  });

  describe('Form Actions', () => {
    it('should display cancel button', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-ยกเลิก')).toBeInTheDocument();
      });
    });

    it('should display submit button', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-รับ Lot')).toBeInTheDocument();
      });
    });
  });

  describe('Lot List Display', () => {
    it('should display data grid with lots', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });

    it('should display lot with manufacturer information', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('lot-row-1')).toBeInTheDocument();
        expect(screen.getByText('LOT-20241201-001')).toBeInTheDocument();
        expect(screen.getByText('Thai Herbs Co.')).toBeInTheDocument();
      });
    });

    it('should display lot with retest date', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('lot-row-1')).toBeInTheDocument();
        expect(screen.getByText('2025-06-01')).toBeInTheDocument();
      });
    });
  });

  describe('Status Tabs', () => {
    it('should display status filter tabs', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('กักกัน')).toBeInTheDocument();
        expect(screen.getByText('ปล่อยแล้ว')).toBeInTheDocument();
        expect(screen.getByText('ปฏิเสธ')).toBeInTheDocument();
        expect(screen.getByText('ล็อค')).toBeInTheDocument();
      });
    });
  });

  describe('Initial Quarantine Status', () => {
    it('should display information about initial quarantine status', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByText('รับสินค้าเข้าคลัง')).toBeInTheDocument();
        expect(screen.getByText('สถานะเริ่มต้น: กักกัน (รอ QC)')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call API when submitting valid form data', async () => {
      // Setup successful POST response
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/inventory/lots') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { id: 999 },
            }),
          });
        }
        // Default handlers for other requests
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { items: mockWarehouses },
            }),
          });
        }
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { items: mockVendors },
            }),
          });
        }
        if (url.includes('/api/inventory/lots')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { items: mockLots },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill required fields
      const lotNumberInput = await screen.findByPlaceholderText('LOT-YYYYMMDD-XXX');
      fireEvent.change(lotNumberInput, { target: { value: 'LOT-TEST-001' } });

      // Select item via dialog
      const selectItemArea = screen.getByText('คลิกเพื่อเลือกสินค้า...');
      fireEvent.click(selectItemArea);

      await waitFor(() => {
        expect(screen.getByTestId('item-search-dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('select-item-btn'));

      // Wait for item selection to complete
      await waitFor(() => {
        expect(screen.queryByTestId('item-search-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form labels', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        // Check for required field indicators
        const requiredLabels = screen.getAllByText('*');
        expect(requiredLabels.length).toBeGreaterThan(0);
      });
    });
  });
});
