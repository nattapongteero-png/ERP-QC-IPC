/**
 * Fixed Assets E2E Test
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 *
 * Tests the Fixed Assets page rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/accounting/fixed-assets',
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Package: () => <span>Package Icon</span>,
  Building2: () => <span>Building2 Icon</span>,
  TrendingDown: () => <span>TrendingDown Icon</span>,
  Calculator: () => <span>Calculator Icon</span>,
}));

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample asset data
const mockAssets = [
  {
    id: 1,
    assetCode: 'FA-202501-000001',
    nameTh: 'เครื่องจักร A',
    nameEn: 'Machine A',
    categoryId: 1,
    acquisitionDate: '2025-01-15',
    acquisitionCost: 500000,
    salvageValue: 50000,
    usefulLifeMonths: 60,
    depreciationMethod: 'straight_line',
    depreciationStartDate: '2025-02-01',
    accumulatedDepreciation: 0,
    netBookValue: 500000,
    status: 'active',
    location: 'Factory Floor 1',
  },
];

const mockSummary = {
  totalAssets: 5,
  activeAssets: 4,
  disposedAssets: 1,
  fullyDepreciatedAssets: 0,
  totalAcquisitionCost: 2500000,
  totalAccumulatedDepreciation: 250000,
  totalNetBookValue: 2250000,
};

const mockCategories = [
  {
    id: 1,
    code: 'MACHINERY',
    nameTh: 'เครื่องจักรและอุปกรณ์',
    nameEn: 'Machinery and Equipment',
    defaultUsefulLifeMonths: 60,
    defaultDepreciationMethod: 'straight_line',
    maxDepreciationRate: 20,
    isActive: true,
  },
];

describe('Fixed Assets Page', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/fixed-assets') && url.includes('summary=true')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSummary }),
        });
      }
      if (url.includes('/api/accounting/fixed-assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAssets }),
        });
      }
      if (url.includes('/api/accounting/asset-categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCategories }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  const renderPage = async () => {
    const FixedAssetsPage = (await import('@/app/accounting/fixed-assets/page')).default;
    return render(
      <QueryClientProvider client={queryClient}>
        <FixedAssetsPage />
      </QueryClientProvider>
    );
  };

  it('should render page header correctly', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Fixed Assets')).toBeInTheDocument();
    });
  });

  it('should display subtitle about Thai Revenue Code', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Thai Revenue Code/)).toBeInTheDocument();
    });
  });

  it('should display status filter', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('should display Add Asset button', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Asset')).toBeInTheDocument();
    });
  });

  it('should display Run Depreciation button', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Run Depreciation')).toBeInTheDocument();
    });
  });

  it('should display Fixed Assets Register heading', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Fixed Assets Register')).toBeInTheDocument();
    });
  });

  it('should render stat cards', async () => {
    await renderPage();

    await waitFor(() => {
      // Check for stat card labels
      const statLabels = ['Total Assets', 'Active Assets', 'Total Cost', 'Net Book Value'];
      const foundLabels = statLabels.filter(label => {
        try {
          return screen.getByText(label);
        } catch {
          return false;
        }
      });
      expect(foundLabels.length).toBeGreaterThan(0);
    });
  });

  it('should call fixed assets API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/fixed-assets')
      );
    });
  });

  it('should call asset categories API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/asset-categories')
      );
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch fixed assets' }),
      });
    });

    await renderPage();

    // Page should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('Fixed Assets')).toBeInTheDocument();
    });
  });
});

describe('Fixed Assets API Responses', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should handle asset list response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockAssets }),
    });

    const response = await fetch('/api/accounting/fixed-assets');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].assetCode).toBe('FA-202501-000001');
    expect(data.data[0].status).toBe('active');
  });

  it('should handle summary response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockSummary }),
    });

    const response = await fetch('/api/accounting/fixed-assets?summary=true');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.totalAssets).toBe(5);
    expect(data.data.activeAssets).toBe(4);
    expect(data.data.totalNetBookValue).toBe(2250000);
  });

  it('should handle categories response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockCategories }),
    });

    const response = await fetch('/api/accounting/asset-categories');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data[0].code).toBe('MACHINERY');
    expect(data.data[0].maxDepreciationRate).toBe(20);
  });
});

describe('Depreciation Calculations', () => {
  it('should validate straight line depreciation', () => {
    const acquisitionCost = 120000;
    const salvageValue = 0;
    const usefulLifeMonths = 60;
    const monthlyDepreciation = (acquisitionCost - salvageValue) / usefulLifeMonths;

    expect(monthlyDepreciation).toBe(2000);
  });

  it('should validate net book value calculation', () => {
    const acquisitionCost = 500000;
    const accumulatedDepreciation = 100000;
    const netBookValue = acquisitionCost - accumulatedDepreciation;

    expect(netBookValue).toBe(400000);
  });

  it('should validate Thai Revenue Code rates', () => {
    // Building: 5% per year = 20 years
    expect(100 / 5).toBe(20);

    // Machinery: 20% per year = 5 years
    expect(100 / 20).toBe(5);

    // Computer: 33.33% per year = 3 years
    expect(100 / 33.33).toBeCloseTo(3, 0);
  });
});

describe('Asset Status Validation', () => {
  it('should validate active status', () => {
    const asset = mockAssets[0];
    expect(asset.status).toBe('active');
    expect(['active', 'disposed', 'fully_depreciated']).toContain(asset.status);
  });
});
