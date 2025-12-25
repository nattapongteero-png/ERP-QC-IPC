import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FixedAssetsPage from '@/app/accounting/fixed-assets/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

    await waitFor(() => {
      expect(screen.getByText('ทรัพย์สินถาวร')).toBeInTheDocument();
      expect(screen.getByText('Fixed Assets')).toBeInTheDocument();
    });
  });

  it('renders KPI cards with proper data', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('ทรัพย์สินทั้งหมด')).toBeInTheDocument();
      expect(screen.getByText('ใช้งาน')).toBeInTheDocument();
      expect(screen.getByText('ราคาทุน')).toBeInTheDocument();
      expect(screen.getByText('มูลค่าสุทธิ')).toBeInTheDocument();
    });
  });

  it('renders filter panel with glassmorphism styling', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const filterPanel = screen.getByTestId('filter-panel');
      expect(filterPanel).toBeInTheDocument();
      expect(filterPanel).toHaveClass('backdrop-blur-md');
    });
  });

  it('renders data grid when loaded', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check loading state changes to grid
      expect(screen.queryByText('กำลังโหลดข้อมูลทรัพย์สิน...')).not.toBeInTheDocument();
    });
  });

  it('shows action buttons in header', async () => {
    render(<FixedAssetsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('เพิ่มทรัพย์สิน')).toBeInTheDocument();
      expect(screen.getByText('คำนวณค่าเสื่อม')).toBeInTheDocument();
    });
  });
});
