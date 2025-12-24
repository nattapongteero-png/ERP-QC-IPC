/**
 * Inventory Lots Page Unit Tests
 * Focus: Lot Receive Dialog UI
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LotsPage from '@/app/inventory/lots/page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({}),
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock PageHeader
vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      <div data-testid="page-header-actions">{actions}</div>
    </div>
  ),
}));

// Mock DxDataGrid
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ dataSource, onRowClick }: { dataSource: unknown[]; onRowClick?: (e: unknown) => void }) => (
    <div data-testid="dx-data-grid">
      <div data-testid="grid-row-count">{dataSource?.length || 0} rows</div>
      {dataSource?.map((item: { id: number; lotNumber: string }, idx: number) => (
        <div
          key={idx}
          data-testid={`grid-row-${item.id}`}
          onClick={() => onRowClick?.({ data: item })}
        >
          {item.lotNumber}
        </div>
      ))}
    </div>
  ),
  DxDataGridColumn: () => null,
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, icon, type, disabled }: { text?: string; onClick?: () => void; icon?: string; type?: string; disabled?: boolean }) => (
    <button
      onClick={onClick}
      data-testid={`dx-button-${text?.replace(/\s+/g, '-') || icon || type}`}
      disabled={disabled}
    >
      {text || icon}
    </button>
  ),
}));

// Mock DxTextBox
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ placeholder, value, onValueChange, disabled }: { placeholder?: string; value?: string; onValueChange?: (v: string) => void; disabled?: boolean }) => (
    <input
      data-testid={`dx-text-box-${placeholder?.replace(/[.\s]+/g, '-').toLowerCase() || 'default'}`}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
    />
  ),
}));

// Mock DxSelectBox
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ items, value, onValueChange, placeholder }: { items: { value: string; label: string }[]; value?: string; onValueChange?: (v: string) => void; placeholder?: string }) => (
    <select
      data-testid={`dx-select-box-${placeholder?.toLowerCase().replace(/\s+/g, '-') || 'default'}`}
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {items?.map((item) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  ),
}));

// Mock DxDateBox
vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: ({ value, onValueChange, min, max }: { value?: string; onValueChange?: (v: string) => void; min?: string; max?: string }) => (
    <input
      type="date"
      data-testid="dx-date-box"
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      min={min}
      max={max}
    />
  ),
}));

// Track popup visibility state
let popupVisibleState: Record<string, boolean> = {};
let popupOnHiddenCallbacks: Record<string, () => void> = {};

// Mock DxPopup - track visibility and support onHidden callback
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ visible, onVisibleChange, onHidden, title, children }: {
    visible: boolean;
    onVisibleChange?: (v: boolean) => void;
    onHidden?: () => void;
    title?: string;
    children: React.ReactNode
  }) => {
    // Store the onHidden callback
    if (title) {
      popupVisibleState[title] = visible;
      if (onHidden) {
        popupOnHiddenCallbacks[title] = onHidden;
      }
    }

    if (!visible) return null;
    return (
      <div data-testid={`dx-popup-${title?.replace(/\s+/g, '-').toLowerCase() || 'default'}`} role="dialog">
        <div data-testid="popup-title">{title}</div>
        <div data-testid="popup-content">{children}</div>
        <button
          data-testid="popup-close"
          onClick={() => {
            onVisibleChange?.(false);
            // Simulate onHidden callback after close animation
            setTimeout(() => onHidden?.(), 0);
          }}
        >
          Close
        </button>
      </div>
    );
  },
}));

// Mock Badge
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid={`badge-${variant || 'default'}`}>{children}</span>
  ),
}));

// Mock EmptyState
vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title, description, action }: { title: string; description: string; action?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <button onClick={action.onClick}>{action.label}</button>}
    </div>
  ),
}));

// Mock ItemSearchDialog
vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: ({ open, onOpenChange, onSelect }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: { id: number; code: string; nameTh: string; primaryUnit: string }) => void
  }) => {
    if (!open) return null;
    return (
      <div data-testid="item-search-dialog" role="dialog">
        <button
          data-testid="select-item-btn"
          onClick={() => {
            onSelect({
              id: 1,
              code: 'ITEM-001',
              nameTh: 'สมุนไพรทดสอบ',
              primaryUnit: 'kg',
            });
            onOpenChange(false);
          }}
        >
          Select Item
        </button>
        <button data-testid="cancel-item-dialog" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
      </div>
    );
  },
}));

// Mock DxLoadIndicator
vi.mock('@/components/ui/dx-load-indicator', () => ({
  DxLoadIndicator: () => <div data-testid="loading-indicator">Loading...</div>,
}));

// Sample test data
const mockLots = [
  {
    id: 1,
    lotNumber: 'LOT-20241224-001',
    itemId: 1,
    itemCode: 'ITEM-001',
    itemName: 'สมุนไพรทดสอบ',
    warehouseId: 1,
    warehouseName: 'คลังหลัก',
    quantity: 100,
    reservedQuantity: 0,
    unit: 'kg',
    status: 'quarantine',
    manufacturingDate: '2024-12-01',
    expiryDate: '2025-12-01',
    receivedDate: '2024-12-24',
    vendorLotNumber: 'V-001',
    vendorId: 1,
    vendorName: 'ผู้ขายทดสอบ',
    cost: 100,
  },
  {
    id: 2,
    lotNumber: 'LOT-20241224-002',
    itemId: 2,
    itemCode: 'ITEM-002',
    itemName: 'สมุนไพร B',
    warehouseId: 1,
    warehouseName: 'คลังหลัก',
    quantity: 50,
    reservedQuantity: 10,
    unit: 'kg',
    status: 'released',
    manufacturingDate: '2024-11-01',
    expiryDate: '2025-06-01',
    receivedDate: '2024-12-20',
    vendorLotNumber: null,
    vendorId: null,
    vendorName: null,
    cost: 200,
  },
];

const mockWarehouses = [
  { id: 1, name: 'คลังหลัก', code: 'WH-01' },
  { id: 2, name: 'คลังสำรอง', code: 'WH-02' },
];

const mockVendors = [
  { id: 1, name: 'ผู้ขายทดสอบ', code: 'V-001' },
  { id: 2, name: 'ผู้ขาย B', code: 'V-002' },
];

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LotsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    popupVisibleState = {};
    popupOnHiddenCallbacks = {};

    // Default fetch responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/inventory/lots')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { items: mockLots } }),
        });
      }
      if (url.includes('/api/warehouses')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { items: mockWarehouses } }),
        });
      }
      if (url.includes('/api/vendors')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { items: mockVendors } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('renders the page with header', async () => {
      render(<LotsPage />);

      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
      expect(screen.getByText('Inventory Lots')).toBeInTheDocument();
    });

    it('renders action buttons', async () => {
      render(<LotsPage />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('View Items')).toBeInTheDocument();
      expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
    });

    it('fetches lots and master data on mount', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/inventory/lots'));
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/warehouses'));
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/vendors'));
      });
    });
  });

  describe('Lot Receive Dialog - Opening', () => {
    it('opens dialog when "รับ Lot ใหม่" button is clicked', async () => {
      render(<LotsPage />);

      const addButton = screen.getByText('รับ Lot ใหม่');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });
    });

    it('shows initial form with empty fields', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        // Check for lot number input
        const lotNumberInput = screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx');
        expect(lotNumberInput).toHaveValue('');
      });
    });
  });

  describe('Lot Receive Dialog - Lot Number Generation', () => {
    it('generates lot number when สร้าง button is clicked', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const generateButton = screen.getByTestId('dx-button-สร้าง');
      fireEvent.click(generateButton);

      await waitFor(() => {
        const lotNumberInput = screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx');
        expect(lotNumberInput.getAttribute('value')).toMatch(/^LOT-\d{8}-\d{3}$/);
      });
    });
  });

  describe('Lot Receive Dialog - Item Selection', () => {
    it('opens item search dialog when item selector is clicked', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const itemSelector = screen.getByText('คลิกเพื่อเลือกสินค้า...');
      fireEvent.click(itemSelector);

      await waitFor(() => {
        expect(screen.getByTestId('item-search-dialog')).toBeInTheDocument();
      });
    });

    it('displays selected item after selection', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('คลิกเพื่อเลือกสินค้า...'));

      await waitFor(() => {
        expect(screen.getByTestId('item-search-dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('select-item-btn'));

      await waitFor(() => {
        expect(screen.getByText('ITEM-001')).toBeInTheDocument();
        expect(screen.getByText('สมุนไพรทดสอบ')).toBeInTheDocument();
      });
    });
  });

  describe('Lot Receive Dialog - Form Validation', () => {
    it('shows validation error when submitting empty form', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('dx-button-รับ-Lot');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Lot number is required')).toBeInTheDocument();
        expect(screen.getByText('Please select an item')).toBeInTheDocument();
        expect(screen.getByText('Please select a warehouse')).toBeInTheDocument();
      });
    });

    it('shows validation error for quantity <= 0', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill lot number
      const lotInput = screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx');
      fireEvent.change(lotInput, { target: { value: 'LOT-001' } });

      // Select item
      fireEvent.click(screen.getByText('คลิกเพื่อเลือกสินค้า...'));
      await waitFor(() => expect(screen.getByTestId('item-search-dialog')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('select-item-btn'));

      // Submit without quantity
      fireEvent.click(screen.getByTestId('dx-button-รับ-Lot'));

      await waitFor(() => {
        expect(screen.getByText('Quantity must be greater than 0')).toBeInTheDocument();
      });
    });

    it('shows validation error for missing expiry date', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill lot number
      fireEvent.change(screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx'), { target: { value: 'LOT-001' } });

      // Submit
      fireEvent.click(screen.getByTestId('dx-button-รับ-Lot'));

      await waitFor(() => {
        expect(screen.getByText('Expiry date is required')).toBeInTheDocument();
      });
    });

    it('shows validation error for missing cost', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill lot number
      fireEvent.change(screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx'), { target: { value: 'LOT-001' } });

      // Submit
      fireEvent.click(screen.getByTestId('dx-button-รับ-Lot'));

      await waitFor(() => {
        expect(screen.getByText('Cost per unit is required and must be greater than 0')).toBeInTheDocument();
      });
    });
  });

  describe('Lot Receive Dialog - Form Submission', () => {
    it('submits form successfully with valid data', async () => {
      mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
        if (url.includes('/api/inventory/lots') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { id: 3, lotNumber: 'LOT-TEST-001' }
            }),
          });
        }
        if (url.includes('/api/inventory/lots')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockLots } }),
          });
        }
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockWarehouses } }),
          });
        }
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockVendors } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      render(<LotsPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/warehouses'));
      });

      // Open dialog
      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill form
      fireEvent.change(screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx'), {
        target: { value: 'LOT-TEST-001' }
      });

      // Select item
      fireEvent.click(screen.getByText('คลิกเพื่อเลือกสินค้า...'));
      await waitFor(() => expect(screen.getByTestId('item-search-dialog')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('select-item-btn'));

      // Select warehouse
      const warehouseSelect = screen.getByTestId('dx-select-box-default');
      fireEvent.change(warehouseSelect, { target: { value: '1' } });

      // Fill quantity (using native input)
      const quantityInputs = document.querySelectorAll('input[type="number"]');
      if (quantityInputs[0]) {
        fireEvent.change(quantityInputs[0], { target: { value: '100' } });
      }

      // Fill cost
      if (quantityInputs[1]) {
        fireEvent.change(quantityInputs[1], { target: { value: '50' } });
      }

      // Fill expiry date
      const dateInputs = screen.getAllByTestId('dx-date-box');
      const expiryDateInput = dateInputs[1]; // Second date box is expiry date
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      fireEvent.change(expiryDateInput, {
        target: { value: futureDate.toISOString().split('T')[0] }
      });

      // Submit
      fireEvent.click(screen.getByTestId('dx-button-รับ-Lot'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/inventory/lots',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });
  });

  describe('Lot Receive Dialog - Closing', () => {
    it('closes dialog when ยกเลิก button is clicked', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('dx-button-ยกเลิก');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('dx-popup-รับ-lot-ใหม่')).not.toBeInTheDocument();
      });
    });

    it('resets form when dialog is closed and reopened', async () => {
      render(<LotsPage />);

      // Open dialog
      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill lot number
      const lotInput = screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx');
      fireEvent.change(lotInput, { target: { value: 'LOT-TEST-123' } });
      expect(lotInput).toHaveValue('LOT-TEST-123');

      // Close dialog
      fireEvent.click(screen.getByTestId('dx-button-ยกเลิก'));

      await waitFor(() => {
        expect(screen.queryByTestId('dx-popup-รับ-lot-ใหม่')).not.toBeInTheDocument();
      });

      // Wait for onHidden to be called
      await new Promise(resolve => setTimeout(resolve, 50));

      // Reopen dialog
      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        const newLotInput = screen.getByTestId('dx-text-box-lot-yyyymmdd-xxx');
        expect(newLotInput).toHaveValue('');
      });
    });
  });

  describe('Lot Receive Dialog - Info Display', () => {
    it('shows initial status as quarantine', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('สถานะเริ่มต้น: กักกัน (รอ QC)')).toBeInTheDocument();
      });
    });

    it('displays selected item unit after selection', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('รับ Lot ใหม่'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select item
      fireEvent.click(screen.getByText('คลิกเพื่อเลือกสินค้า...'));
      await waitFor(() => expect(screen.getByTestId('item-search-dialog')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('select-item-btn'));

      await waitFor(() => {
        // The unit should be set from the selected item (kg)
        const unitInput = screen.getByTestId('dx-text-box-default');
        expect(unitInput).toHaveValue('kg');
        expect(unitInput).toBeDisabled();
      });
    });
  });

  describe('Status Filter Tabs', () => {
    it('renders status filter tabs', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('กักกัน')).toBeInTheDocument();
        expect(screen.getByText('ปล่อยแล้ว')).toBeInTheDocument();
        expect(screen.getByText('ปฏิเสธ')).toBeInTheDocument();
        expect(screen.getByText('ล็อค')).toBeInTheDocument();
      });
    });

    it('filters lots by status when tab is clicked', async () => {
      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });

      // Click quarantine tab
      fireEvent.click(screen.getByText('กักกัน'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('status=quarantine'));
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to items page when View Items is clicked', async () => {
      render(<LotsPage />);

      fireEvent.click(screen.getByText('View Items'));

      expect(mockPush).toHaveBeenCalledWith('/inventory/items');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no lots exist', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/inventory/lots')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: [] } }),
          });
        }
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockWarehouses } }),
          });
        }
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockVendors } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('ไม่พบ Lot')).toBeInTheDocument();
      });
    });

    it('opens dialog when empty state action is clicked', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/inventory/lots')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: [] } }),
          });
        }
        if (url.includes('/api/warehouses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockWarehouses } }),
          });
        }
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { items: mockVendors } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      render(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      // Click the action button in empty state (inside the empty-state component)
      const emptyState = screen.getByTestId('empty-state');
      const actionButton = emptyState.querySelector('button');
      expect(actionButton).not.toBeNull();
      fireEvent.click(actionButton!);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });
});
