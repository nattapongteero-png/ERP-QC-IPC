/**
 * Purchase Orders List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import PurchaseOrdersPage from '@/app/purchasing/orders/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_PURCHASE_ORDERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock MainLayout to just render children
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

describe('PurchaseOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock({
        '/api/purchasing/orders': { data: createPaginatedResponse(MOCK_PURCHASE_ORDERS) },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      await waitFor(() => {
        // Title from i18n: t('orders.pageTitle') = 'Purchase Orders'
        expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      });
    });

    it('should render new PO button', async () => {
      setupFetchMock({
        '/api/purchasing/orders': { data: createPaginatedResponse(MOCK_PURCHASE_ORDERS) },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      await waitFor(() => {
        // Button text from i18n: t('orders.actions.createPO') = 'Create PO'
        expect(screen.getByText('Create PO')).toBeInTheDocument();
      });
    });

    it('should render status filter tabs', async () => {
      setupFetchMock({
        '/api/purchasing/orders': { data: createPaginatedResponse(MOCK_PURCHASE_ORDERS) },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      await waitFor(() => {
        // Status labels from i18n
        expect(screen.getByText('All')).toBeInTheDocument(); // t('orders.status.all')
        expect(screen.getByText('Draft')).toBeInTheDocument(); // t('orders.status.draft')
        expect(screen.getByText('Approved')).toBeInTheDocument(); // t('orders.status.approved')
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch purchase orders on mount', async () => {
      setupFetchMock({
        '/api/purchasing/orders': { data: createPaginatedResponse(MOCK_PURCHASE_ORDERS) },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const ordersCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/purchasing/orders')
      );
      expect(ordersCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/purchasing/orders': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      await waitFor(() => {
        // Title from i18n: t('orders.pageTitle') = 'Purchase Orders'
        expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/purchasing/orders': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      // Page should still render even on API error
      await waitFor(() => {
        // Title from i18n: t('orders.pageTitle') = 'Purchase Orders'
        expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_PURCHASE_ORDERS);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', async () => {
      setupFetchMock({
        '/api/purchasing/orders': { data: createPaginatedResponse(MOCK_PURCHASE_ORDERS) },
      });

      renderWithProviders(<PurchaseOrdersPage />);

      await waitFor(() => {
        // Thai placeholder text
        // Placeholder from i18n: t('orders.searchPlaceholder') = 'Search by PO number or vendor name...'
        expect(screen.getByPlaceholderText('Search by PO number or vendor name...')).toBeInTheDocument();
      });
    });
  });
});
