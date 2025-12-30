/**
 * AR Receipts Page Test
 * Feature: 010-accounting-module-integration
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
  usePathname: () => '/accounting/ar/receipts',
}));

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    Banknote: MockIcon,
    CreditCard: MockIcon,
    Building2: MockIcon,
    Calendar: MockIcon,
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockReceipts = [
  {
    id: 1,
    receiptNumber: 'RCP-001',
    customerId: 1,
    customerName: 'Customer A',
    receiptDate: '2025-01-20',
    paymentMethod: 'bank_transfer',
    amount: 10700,
    currency: 'THB',
    reference: 'TXN123',
    description: 'Payment for AR-001',
    bankAccountId: 1,
    bankAccountName: 'Bank Account 1',
    chequeNumber: null,
    chequeDate: null,
    status: 'cleared',
    createdAt: '2025-01-20T10:00:00Z',
  },
];

describe('AR Receipts Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/payments')) {
        if (url.includes('summary=true')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                totalReceipts: 1,
                totalAmount: 10700,
                pendingAmount: 0,
                clearedAmount: 10700,
                receiptsByMethod: {},
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockReceipts }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';

  const renderPage = async () => {
    const ARReceiptsPage = (await import('@/app/accounting/ar/receipts/page')).default;
    return render(
      <Wrapper>
        <ARReceiptsPage />
      </Wrapper>
    );
  };

  it('renders page header with correct title', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Receipts')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('renders KPI cards', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Receipts')).toBeInTheDocument();
      expect(screen.getByText('Total Amount')).toBeInTheDocument();
      expect(screen.getByText('Cleared')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('renders filter panel with payment method selector', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeInTheDocument();
    });
  });

  it('renders receipt list section', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Receipt List')).toBeInTheDocument();
    });
  });

  it('calls payments API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/payments')
      );
    });
  });
});
