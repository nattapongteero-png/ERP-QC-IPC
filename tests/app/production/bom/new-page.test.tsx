/**
 * New BOM Page — Material Picker UI Test
 * Verifies the redesigned multi-select material picker renders, exposes the
 * "+ เพิ่ม Item ใหม่" action, and opens the create-item dialog without runtime
 * errors. Covers the allowCreate-from-picker feature.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/production/bom/new',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// --- UI primitives ---
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, disabled, elementAttr }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={elementAttr?.['data-testid']}>
      {text}
    </button>
  ),
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, onValueChange, placeholder }: any) => (
    <input value={value || ''} placeholder={placeholder} onChange={(e) => onValueChange?.(e.target.value)} />
  ),
}));

vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ value, onValueChange }: any) => (
    <input type="number" value={value || 0} onChange={(e) => onValueChange?.(Number(e.target.value))} />
  ),
}));

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: ({ value, onValueChange }: any) => (
    <input value={value || ''} onChange={(e) => onValueChange?.(e.target.value)} />
  ),
}));

vi.mock('@/components/ui/dx-check-box', () => ({
  DxCheckBox: ({ value, onValueChange }: any) => (
    <input type="checkbox" checked={!!value} onChange={(e) => onValueChange?.(e.target.checked)} />
  ),
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ value, onValueChange }: any) => (
    <select value={value || ''} onChange={(e) => onValueChange?.(e.target.value)} />
  ),
}));

// DxPopup only renders children when visible (matches real behaviour)
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ visible, children }: any) => (visible ? <div data-testid="popup">{children}</div> : null),
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ dataSource }: any) => (
    <div data-testid="data-grid">{(dataSource || []).length} rows</div>
  ),
  DxColumn: () => null,
  DxScrolling: () => null,
  DxSelection: () => null,
  DxPaging: () => null,
}));

vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: ({ open }: any) => (open ? <div data-testid="product-dialog" /> : null),
  Item: {},
}));

// Capture ItemEditDialog open state so we can assert the picker opens it
const itemEditOpenSpy = vi.fn();
vi.mock('@/components/ui/item-edit-dialog', () => ({
  ItemEditDialog: ({ open }: any) => {
    itemEditOpenSpy(open);
    return open ? <div data-testid="create-item-dialog" /> : null;
  },
}));

import NewBOMPage from '@/app/production/bom/new/page';

describe('NewBOMPage — material picker', () => {
  beforeEach(() => {
    itemEditOpenSpy.mockClear();
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          items: [
            { id: 1, code: 'RM-0001', nameTh: 'ผงขมิ้นชัน', type: 'raw_material', primaryUnit: 'kg', onHand: 1147 },
            { id: 2, code: 'PK-0001', nameTh: 'แคปซูลเปล่า', type: 'packaging', primaryUnit: 'box', onHand: 60 },
          ],
        },
      }),
    }) as any;
  });

  it('renders the page without crashing', () => {
    render(<NewBOMPage />);
    expect(screen.getByText('Create New BOM')).toBeInTheDocument();
  });

  it('opens the material picker and shows the "เพิ่ม Item ใหม่" action', async () => {
    render(<NewBOMPage />);
    fireEvent.click(screen.getByText('Add Material'));
    await waitFor(() => {
      expect(screen.getByTestId('bom-material-create-btn')).toBeInTheDocument();
    });
  });

  it('opens the create-item dialog from inside the picker', async () => {
    render(<NewBOMPage />);
    fireEvent.click(screen.getByText('Add Material'));
    const createBtn = await screen.findByTestId('bom-material-create-btn');
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(screen.getByTestId('create-item-dialog')).toBeInTheDocument();
    });
  });
});
