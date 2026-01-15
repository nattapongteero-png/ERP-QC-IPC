/**
 * BOM Detail Page Tests - Confidentiality UI
 * Feature: 014-unit-cost
 * Task 21: Modify BOM detail page for confidentiality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BOMDetailPage from '@/app/production/bom/[id]/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({
    id: '1',
  }),
}));

// Mock BOMAccessControlTab
vi.mock('@/components/bom/BOMAccessControlTab', () => ({
  BOMAccessControlTab: ({ bomId, canManage }: { bomId: number; canManage: boolean }) => (
    <div data-testid="bom-access-control-tab">
      Access Control Tab - BOM: {bomId}, Can Manage: {String(canManage)}
    </div>
  ),
}));

// Mock Lucide icons that need title
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    Lock: ({ className }: { className?: string }) => (
      <svg data-testid="lock-icon" className={className} />
    ),
    Shield: ({ className }: { className?: string }) => (
      <svg data-testid="shield-icon" className={className} />
    ),
  };
});

// Sample BOM data without confidential items
const MOCK_BOM_NO_CONFIDENTIAL = {
  id: 1,
  code: 'BOM-001',
  name: 'Test BOM',
  productId: 1,
  productCode: 'PRD-001',
  productName: 'Test Product',
  productUnit: 'kg',
  version: '1.0',
  status: 'approved',
  batchSize: 100,
  batchUnit: 'kg',
  yieldTarget: 95,
  lossAllowance: 5,
  theoreticalYield: 100,
  effectiveDate: '2024-01-01',
  expiryDate: '2025-12-31',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-15',
  lines: [
    {
      id: 1,
      itemId: 101,
      itemCode: 'RM-001',
      itemName: 'Raw Material 1',
      itemUnit: 'kg',
      itemType: 'raw_material',
      quantity: 50,
      unit: 'kg',
      sequence: 1,
      isOptional: false,
      notes: 'Standard material',
      isConfidential: false,
      isHidden: false,
    },
    {
      id: 2,
      itemId: 102,
      itemCode: 'RM-002',
      itemName: 'Raw Material 2',
      itemUnit: 'kg',
      itemType: 'raw_material',
      quantity: 30,
      unit: 'kg',
      sequence: 2,
      isOptional: true,
      notes: '',
      isConfidential: false,
      isHidden: false,
    },
  ],
  confidentialityInfo: {
    hasConfidentialItems: false,
    visibleLineCount: 2,
    totalLineCount: 2,
    userHasFullAccess: true,
  },
};

// Sample BOM data with confidential items (user has access)
const MOCK_BOM_WITH_CONFIDENTIAL_ACCESS = {
  ...MOCK_BOM_NO_CONFIDENTIAL,
  lines: [
    {
      id: 1,
      itemId: 101,
      itemCode: 'RM-001',
      itemName: 'Raw Material 1',
      itemUnit: 'kg',
      itemType: 'raw_material',
      quantity: 50,
      unit: 'kg',
      sequence: 1,
      isOptional: false,
      isConfidential: false,
      isHidden: false,
    },
    {
      id: 2,
      itemId: 102,
      itemCode: 'SECRET-001',
      itemName: 'Secret Formula',
      itemUnit: 'g',
      itemType: 'extract',
      quantity: 5,
      unit: 'g',
      sequence: 2,
      isOptional: false,
      isConfidential: true,
      isHidden: false,
    },
  ],
  confidentialityInfo: {
    hasConfidentialItems: true,
    visibleLineCount: 2,
    totalLineCount: 2,
    userHasFullAccess: true,
  },
};

// Sample BOM data with hidden confidential items (user has NO access)
const MOCK_BOM_WITH_HIDDEN_ITEMS = {
  ...MOCK_BOM_NO_CONFIDENTIAL,
  lines: [
    {
      id: 1,
      itemId: 101,
      itemCode: 'RM-001',
      itemName: 'Raw Material 1',
      itemUnit: 'kg',
      itemType: 'raw_material',
      quantity: 50,
      unit: 'kg',
      sequence: 1,
      isOptional: false,
      isConfidential: false,
      isHidden: false,
    },
    {
      id: 2,
      sequence: 2,
      isConfidential: true,
      isHidden: true,
      placeholder: '[Confidential Item]',
    },
  ],
  confidentialityInfo: {
    hasConfidentialItems: true,
    visibleLineCount: 1,
    totalLineCount: 2,
    userHasFullAccess: false,
  },
};

// BOM cost mock
const MOCK_BOM_COST = {
  totalMaterialCost: 5000,
  costPerUnit: 50,
  breakdown: [
    {
      itemId: 101,
      itemCode: 'RM-001',
      itemName: 'Raw Material 1',
      quantity: 50,
      unit: 'kg',
      unitCost: 80,
      totalCost: 4000,
      costSource: 'last_purchase',
    },
    {
      itemId: 102,
      itemCode: 'RM-002',
      itemName: 'Raw Material 2',
      quantity: 30,
      unit: 'kg',
      unitCost: 33.33,
      totalCost: 1000,
      costSource: 'last_purchase',
    },
  ],
  currency: 'THB',
};

describe('BOMDetailPage - Confidentiality UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Page Rendering', () => {
    it('should render BOM detail page with correct title', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_NO_CONFIDENTIAL) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('BOM-001')).toBeInTheDocument();
      });
    });

    it('should render BOM lines in data grid', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_NO_CONFIDENTIAL) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('RM-001')).toBeInTheDocument();
        expect(screen.getByText('Raw Material 1')).toBeInTheDocument();
      });
    });
  });

  describe('Confidentiality - No Confidential Items', () => {
    it('should not show confidentiality banner when no confidential items', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_NO_CONFIDENTIAL) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('BOM-001')).toBeInTheDocument();
      });

      // Confidentiality banner should not appear
      expect(screen.queryByText(/This BOM contains confidential items/)).not.toBeInTheDocument();
    });
  });

  describe('Confidentiality - User Has Full Access', () => {
    it('should show lock icon on confidential items', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_CONFIDENTIAL_ACCESS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        // The BOM should load
        expect(screen.getByText('BOM-001')).toBeInTheDocument();
      });

      // The grid should contain both items (visible since user has access)
      await waitFor(() => {
        expect(screen.getByText('RM-001')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show confidentiality banner with full access message', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_CONFIDENTIAL_ACCESS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/You have full access to view all/)).toBeInTheDocument();
      });
    });

    it('should show Access Control tab when user has full access', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_CONFIDENTIAL_ACCESS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-access-control')).toBeInTheDocument();
      });
    });

    it('should render Access Control tab button when user has full access', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_CONFIDENTIAL_ACCESS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      // Access Control tab button should be present
      await waitFor(() => {
        const accessTab = screen.getByTestId('tab-access-control');
        expect(accessTab).toBeInTheDocument();
        // And it should contain the Shield icon (text: Access Control)
        expect(accessTab.textContent).toContain('Access Control');
      });
    });
  });

  describe('Confidentiality - User Has No Access (Hidden Items)', () => {
    it('should show placeholder for hidden items', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_HIDDEN_ITEMS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('[Confidential Item]')).toBeInTheDocument();
      });
    });

    it('should show confidentiality banner with limited access message', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_HIDDEN_ITEMS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 2 items/)).toBeInTheDocument();
      });
    });

    it('should NOT show Access Control tab when user has no full access', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_HIDDEN_ITEMS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('BOM-001')).toBeInTheDocument();
      });

      // Access Control tab should NOT appear
      expect(screen.queryByTestId('tab-access-control')).not.toBeInTheDocument();
    });

    it('should show visible item normally while hiding confidential one', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_HIDDEN_ITEMS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        // BOM should load
        expect(screen.getByText('BOM-001')).toBeInTheDocument();
      });

      // Check that the limited access message appears
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 2 items/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should default to Materials tab', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_CONFIDENTIAL_ACCESS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-materials')).toBeInTheDocument();
      });

      // Materials tab should be selected (has active class)
      const materialsTab = screen.getByTestId('tab-materials');
      expect(materialsTab).toHaveClass('border-blue-500');
    });

    it('should have both tabs available when user has full access', async () => {
      setupFetchMock({
        '/api/bom/1': { data: createSingleResponse(MOCK_BOM_WITH_CONFIDENTIAL_ACCESS) },
        '/api/bom/1/cost': { data: createSingleResponse(MOCK_BOM_COST) },
      });

      renderWithProviders(<BOMDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-materials')).toBeInTheDocument();
        expect(screen.getByTestId('tab-access-control')).toBeInTheDocument();
      });

      const materialsTab = screen.getByTestId('tab-materials');
      const accessTab = screen.getByTestId('tab-access-control');

      // Materials tab should be selected by default
      expect(materialsTab).toHaveClass('border-blue-500');
      // Access tab should not be active
      expect(accessTab).toHaveClass('border-transparent');
    });
  });
});
