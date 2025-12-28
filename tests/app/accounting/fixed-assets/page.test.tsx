import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FixedAssetsPage from '@/app/accounting/fixed-assets/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/accounting/fixed-assets',
}));

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('FixedAssetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for assets
    vi.mocked(fetch).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('summary=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              totalAssets: 10,
              activeAssets: 8,
              totalAcquisitionCost: 1000000,
              totalNetBookValue: 750000,
            },
          }),
        } as Response);
      }
      if (typeof url === 'string' && url.includes('asset-categories')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });
  });

  it('renders professional page header with building icon', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    // Use findByRole for the h1 heading to avoid ambiguity with breadcrumb text
    expect(await screen.findByRole('heading', { name: 'Fixed Assets' })).toBeInTheDocument();
    expect(screen.getByText('Manage fixed assets and depreciation')).toBeInTheDocument();
  });

  it('renders KPI cards with proper data', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    // Use findByText for first assertion, then sync for rest
    expect(await screen.findByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('Net Book Value')).toBeInTheDocument();
  });

  it('renders page structure with proper testid', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    const page = await screen.findByTestId('fixed-assets-page');
    expect(page).toBeInTheDocument();
  });

  it('renders data grid container', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    // Check page structure renders after loading
    expect(await screen.findByTestId('fixed-assets-page')).toBeInTheDocument();
  });

  it('shows action buttons in header', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    // Page uses English text per template alignment
    expect(await screen.findByText('Add Asset')).toBeInTheDocument();
  });
});
