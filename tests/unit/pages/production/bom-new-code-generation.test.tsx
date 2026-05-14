/**
 * BOM New Page - Unique Code Generation Tests
 *
 * Tests that BOM code auto-generation:
 * 1. Uses BOM-{productCode} when no conflict
 * 2. Appends -V2, -V3, etc. when code already exists
 * 3. Falls back to timestamp suffix on fetch error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createPaginatedResponse } from '../../../helpers/ui-test-utils';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Track code values set through DxTextBox
let capturedCodeValue = '';

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: (props: any) => {
    // Capture the BOM code field value
    if (props.placeholder === 'e.g. BOM-001' || props.value?.startsWith?.('BOM-')) {
      capturedCodeValue = props.value || '';
    }
    return <input data-testid={`textbox-${props.placeholder || 'default'}`} value={props.value || ''} readOnly />;
  },
}));

// Capture product dialog callbacks
let productDialogOnSelect: ((item: any) => void) | null = null;

vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: (props: any) => {
    productDialogOnSelect = props.onSelect;
    return props.open ? <div data-testid="item-search-dialog">Dialog</div> : null;
  },
}));

// Mock other UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: (props: any) => <button data-testid={`btn-${props.text || 'default'}`} onClick={props.onClick}>{props.text}</button>,
}));

vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: () => <input type="number" readOnly />,
}));

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: () => <input type="date" readOnly />,
}));

vi.mock('@/components/ui/dx-check-box', () => ({
  DxCheckBox: () => <input type="checkbox" readOnly />,
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: () => <select><option>-</option></select>,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children }: any) => <div>{children}</div>,
  DxDataGridColumn: () => null,
}));

vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: () => null,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

import NewBOMPage from '@/app/production/bom/new/page';

const mockProduct = {
  id: 1,
  code: 'FG-0001',
  nameTh: 'แคปซูลขมิ้นชัน 500mg',
  nameEn: 'Turmeric Capsule 500mg',
  primaryUnit: 'bottle',
  type: 'finished_goods',
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderPage() {
  capturedCodeValue = '';
  productDialogOnSelect = null;
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <NewBOMPage />
    </QueryClientProvider>
  );
}

describe('BOM New Page - Unique Code Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCodeValue = '';
    productDialogOnSelect = null;
  });

  it('should render the page', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createPaginatedResponse([])),
    }) as any;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Create BOM')).toBeInTheDocument();
    });
  });

  it('should generate BOM-{productCode} when no conflict exists', async () => {
    // Mock: search returns no existing BOMs
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/bom') && urlStr.includes('search=BOM-FG-0001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createPaginatedResponse([])),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createPaginatedResponse([])),
      });
    }) as any;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Create BOM')).toBeInTheDocument();
    });

    // Simulate product selection via dialog callback
    await act(async () => {
      if (productDialogOnSelect) {
        await productDialogOnSelect(mockProduct);
      }
    });

    // Wait for state update
    await waitFor(() => {
      expect(capturedCodeValue).toBe('BOM-FG-0001');
    });
  });

  it('should generate BOM-{productCode}-V2 when base code already exists', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/bom') && urlStr.includes('search=BOM-FG-0001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(
            createPaginatedResponse([{ id: 1, code: 'BOM-FG-0001', name: 'Existing BOM' }])
          ),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createPaginatedResponse([])),
      });
    }) as any;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Create BOM')).toBeInTheDocument();
    });

    await act(async () => {
      if (productDialogOnSelect) {
        await productDialogOnSelect(mockProduct);
      }
    });

    await waitFor(() => {
      expect(capturedCodeValue).toBe('BOM-FG-0001-V2');
    });
  });

  it('should generate BOM-{productCode}-V3 when V2 also exists', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/bom') && urlStr.includes('search=BOM-FG-0001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(
            createPaginatedResponse([
              { id: 1, code: 'BOM-FG-0001', name: 'Original BOM' },
              { id: 2, code: 'BOM-FG-0001-V2', name: 'Version 2' },
            ])
          ),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createPaginatedResponse([])),
      });
    }) as any;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Create BOM')).toBeInTheDocument();
    });

    await act(async () => {
      if (productDialogOnSelect) {
        await productDialogOnSelect(mockProduct);
      }
    });

    await waitFor(() => {
      expect(capturedCodeValue).toBe('BOM-FG-0001-V3');
    });
  });

  it('should generate fallback code with timestamp on fetch error', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/bom') && urlStr.includes('search=BOM-FG-0001')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createPaginatedResponse([])),
      });
    }) as any;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Create BOM')).toBeInTheDocument();
    });

    await act(async () => {
      if (productDialogOnSelect) {
        await productDialogOnSelect(mockProduct);
      }
    });

    await waitFor(() => {
      // Should start with BOM-FG-0001- and have a timestamp suffix
      expect(capturedCodeValue).toMatch(/^BOM-FG-0001-.+$/);
      // Should NOT be V2 pattern (that's for successful duplicate detection)
      expect(capturedCodeValue).not.toMatch(/^BOM-FG-0001-V\d+$/);
    });
  });

  it('should auto-fill BOM name when product is selected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { items: [], total: 0, page: 1, limit: 100, totalPages: 0 },
      }),
    }) as any;

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Create BOM')).toBeInTheDocument();
    });

    await act(async () => {
      if (productDialogOnSelect) {
        await productDialogOnSelect(mockProduct);
      }
    });

    // The name should be auto-filled
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('BOM for แคปซูลขมิ้นชัน 500mg');
      expect(nameInput).toBeInTheDocument();
    });
  });
});
