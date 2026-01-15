/**
 * Vendors List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import VendorsPage from '@/app/purchasing/vendors/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_VENDORS, COMMON_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock MainLayout to just render children
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

describe('VendorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(COMMON_FETCH_HANDLERS);

      renderWithProviders(<VendorsPage />);

      await waitFor(() => {
        // Thai text for "Vendors"
        expect(screen.getByText('ผู้ขาย')).toBeInTheDocument();
      });
    });

    it('should render new vendor button', async () => {
      setupFetchMock(COMMON_FETCH_HANDLERS);

      renderWithProviders(<VendorsPage />);

      await waitFor(() => {
        // Thai text for "Add Vendor"
        expect(screen.getByText('เพิ่มผู้ขาย')).toBeInTheDocument();
      });
    });

    it('should render status filter tabs', async () => {
      setupFetchMock(COMMON_FETCH_HANDLERS);

      renderWithProviders(<VendorsPage />);

      // Wait for data to load first
      await waitFor(() => {
        expect(screen.getByText('ผู้ขาย')).toBeInTheDocument();
      });

      // Then check for status tabs (Thai text)
      expect(screen.getByText('ทั้งหมด')).toBeInTheDocument(); // "All"
      // VMI appears in multiple places (tab and badge), so use getAllByText
      expect(screen.getAllByText('VMI').length).toBeGreaterThan(0);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch vendors on mount', async () => {
      setupFetchMock(COMMON_FETCH_HANDLERS);

      renderWithProviders(<VendorsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const vendorsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/vendors')
      );
      expect(vendorsCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/vendors': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<VendorsPage />);

      await waitFor(() => {
        expect(screen.getByText('ผู้ขาย')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/vendors': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<VendorsPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('ผู้ขาย')).toBeInTheDocument();
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_VENDORS);

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
      setupFetchMock(COMMON_FETCH_HANDLERS);

      renderWithProviders(<VendorsPage />);

      await waitFor(() => {
        // Thai placeholder text
        expect(screen.getByPlaceholderText('ค้นหาด้วยรหัส ชื่อ หรือผู้ติดต่อ...')).toBeInTheDocument();
      });
    });
  });
});
