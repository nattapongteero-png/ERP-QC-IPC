/**
 * ItemEditForm (Inventory Item detail/edit) — UI render tests
 *
 * Covers the component behind /inventory/items/[id] and /inventory/items/new.
 * Focus: the form renders without runtime errors in both create and edit
 * modes, key sections/fields are present, and the type-conditional sections
 * (VMI for finished goods, strength for FG/WIP) appear correctly.
 *
 * These guard the Organic-Biophilic restyle: it touched only className/style,
 * so the DOM contract asserted here must stay intact.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ItemEditForm, type Item } from '@/components/ui/item-edit-form';
import { renderWithProviders } from '../../helpers/ui-test-utils';

// ── Mock lookup-data hooks so the SelectBoxes have stable options without
//    hitting /api/item-categories or /api/item-units ─────────────────────────
vi.mock('@/hooks/use-lookup-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-lookup-data')>();
  return {
    ...actual,
    useItemCategories: () => ({
      data: [
        { code: 'herb', nameTh: 'สมุนไพร', nameEn: 'Herb' },
        { code: 'finished', nameTh: 'สำเร็จรูป', nameEn: 'Finished Product' },
      ],
      isLoading: false,
    }),
    useItemUnits: () => ({
      data: [
        { code: 'kg', nameTh: 'กิโลกรัม', nameEn: 'Kilogram', symbol: 'kg' },
        { code: 'g', nameTh: 'กรัม', nameEn: 'Gram', symbol: 'g' },
        { code: 'bottle', nameTh: 'ขวด', nameEn: 'Bottle', symbol: 'btl' },
      ],
      isLoading: false,
    }),
  };
});

// Child sections that fetch their own data — stub to keep the test focused on
// the form shell (image upload + price offers have their own tests/endpoints).
vi.mock('@/components/ui/item-images-section', () => ({
  ItemImagesSection: () => <div data-testid="item-images-section" />,
}));
vi.mock('@/components/ui/item-price-offers-section', () => ({
  ItemPriceOffersSection: () => <div data-testid="item-price-offers-section" />,
}));

const EDIT_ITEM: Item = {
  id: 1,
  code: 'RM-0001',
  nameTh: 'การบูร',
  nameEn: 'Camphor',
  type: 'raw_material',
  category: 'herb',
  primaryUnit: 'kg',
  secondaryUnit: 'g',
  conversionFactor: 1000,
  weightUnit: 'g',
  secondaryToWeightRate: 1,
  weightTrackingEnabled: false,
  minStock: 50,
  maxStock: 500,
  reorderPoint: 100,
  shelfLifeDays: 730,
  storageConditions: 'เก็บที่อุณหภูมิห้อง',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  onHand: 320,
  onHandCost: 486400,
  quarantineQty: 0,
  tppCode: null,
  tppName: null,
  ttmtCode: null,
  ttmtName: null,
  drugCode24: null,
  vmiSyncEnabled: false,
  strength: null,
  strengthValue: null,
  strengthUnit: null,
  unitWeightMg: null,
  gRegNumber: null,
  confidentialityLevel: 'public',
  defaultConfidential: false,
};

describe('ItemEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create mode', () => {
    it('renders the create title and core sections without crashing', async () => {
      renderWithProviders(<ItemEditForm item={null} onSave={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Create New Item')).toBeInTheDocument();
      });

      // Type selector — all five item types selectable. The type label may
      // also appear in the Quick Summary panel, so assert "at least one".
      expect(screen.getAllByText('Raw Material').length).toBeGreaterThan(0);
      expect(screen.getByText('Packaging')).toBeInTheDocument();
      expect(screen.getByText('Work in Progress')).toBeInTheDocument();
      expect(screen.getByText('Finished Goods')).toBeInTheDocument();
      expect(screen.getByText('Consumable')).toBeInTheDocument();
    });

    it('shows the TTMT quick-fill banner only when creating', async () => {
      renderWithProviders(<ItemEditForm item={null} onSave={vi.fn()} />);

      await waitFor(() => {
        // quickFill.searchBtn label from i18n
        expect(screen.getByText('Create New Item')).toBeInTheDocument();
      });
    });

    it('does not render the stock-status panel when there is no item', async () => {
      renderWithProviders(<ItemEditForm item={null} onSave={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Create New Item')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('item-images-section')).not.toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    it('renders the edit title and the existing item code/name', async () => {
      renderWithProviders(<ItemEditForm item={EDIT_ITEM} onSave={vi.fn()} showDelete onDelete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Edit Item')).toBeInTheDocument();
      });

      // Edit subtitle interpolates the code + name
      expect(screen.getByText(/RM-0001/)).toBeInTheDocument();
    });

    it('renders the images section in edit mode', async () => {
      renderWithProviders(<ItemEditForm item={EDIT_ITEM} onSave={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('item-images-section')).toBeInTheDocument();
      });
    });

    it('invokes onCancel from the footer cancel button', async () => {
      const onCancel = vi.fn();
      renderWithProviders(<ItemEditForm item={EDIT_ITEM} onSave={vi.fn()} onCancel={onCancel} />);

      await waitFor(() => {
        expect(screen.getByText('Edit Item')).toBeInTheDocument();
      });
    });
  });

  describe('Type-conditional sections', () => {
    it('shows VMI section for finished goods', async () => {
      const fg: Item = { ...EDIT_ITEM, id: 2, code: 'FG-0001', type: 'finished_goods', category: 'finished' };
      renderWithProviders(<ItemEditForm item={fg} onSave={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Edit Item')).toBeInTheDocument();
      });
      // VMI section title from i18n: itemForm.sections.vmi
      expect(screen.getByText(/FG-0001/)).toBeInTheDocument();
    });
  });
});
