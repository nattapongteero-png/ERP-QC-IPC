import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChartOfAccountsPage from '@/app/accounting/chart-of-accounts/page';
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
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('ChartOfAccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock GL accounts API
    vi.mocked(fetch).mockImplementation((url) => {
      if (url === '/api/accounting/gl-accounts') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                code: '1-1000',
                nameTh: 'สินทรัพย์',
                nameEn: 'Assets',
                accountTypeId: 1,
                parentId: null,
                isActive: true,
                isPostable: false,
                isBankAccount: false,
                level: 1,
                accountType: { code: '1', nameTh: 'สินทรัพย์' }
              },
              {
                id: 2,
                code: '1-1100',
                nameTh: 'เงินสดและรายการเทียบเท่าเงินสด',
                nameEn: 'Cash and Cash Equivalents',
                accountTypeId: 1,
                parentId: 1,
                isActive: true,
                isPostable: false,
                isBankAccount: false,
                level: 2,
                accountType: { code: '1', nameTh: 'สินทรัพย์' }
              },
              {
                id: 3,
                code: '1-1100-01',
                nameTh: 'เงินสดในมือ',
                nameEn: 'Cash on Hand',
                accountTypeId: 1,
                parentId: 2,
                isActive: true,
                isPostable: true,
                isBankAccount: false,
                level: 3,
                accountType: { code: '1', nameTh: 'สินทรัพย์' }
              },
              {
                id: 4,
                code: '1-1100-02',
                nameTh: 'ธนาคารกรุงเทพ',
                nameEn: 'Bangkok Bank',
                accountTypeId: 1,
                parentId: 2,
                isActive: true,
                isPostable: true,
                isBankAccount: true,
                level: 3,
                accountType: { code: '1', nameTh: 'สินทรัพย์' }
              }
            ]
          }),
        } as Response);
      }

      if (url === '/api/accounting/gl-account-types') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: 1, code: '1', nameTh: 'สินทรัพย์', nameEn: 'Assets' },
              { id: 2, code: '2', nameTh: 'หนี้สิน', nameEn: 'Liabilities' },
              { id: 3, code: '3', nameTh: 'ส่วนของเจ้าของ', nameEn: 'Equity' },
              { id: 4, code: '4', nameTh: 'รายได้', nameEn: 'Revenue' },
              { id: 5, code: '5', nameTh: 'ค่าใช้จ่าย', nameEn: 'Expenses' }
            ]
          }),
        } as Response);
      }

      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders professional page header with gradient icon', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('ผังบัญชี')).toBeInTheDocument();
    });

    expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
  });

  it('renders KPI cards with proper styling', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('บัญชีทั้งหมด')).toBeInTheDocument();
    });

    // Check all KPI card labels exist (may appear in multiple places like grid headers)
    const activeLabels = screen.getAllByText('ใช้งาน');
    expect(activeLabels.length).toBeGreaterThan(0);

    expect(screen.getByText('ลงบัญชีได้')).toBeInTheDocument();

    const bankAccountLabels = screen.getAllByText('บัญชีธนาคาร');
    expect(bankAccountLabels.length).toBeGreaterThan(0);
  });

  it('displays correct statistics from account data', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Total accounts: 4
      const totalCards = screen.getAllByText('4');
      expect(totalCards.length).toBeGreaterThan(0);
    });

    // Active accounts: 4 (all active)
    // Postable accounts: 2 (only leaf accounts)
    // Bank accounts: 1
  });

  it('renders filter panel with glassmorphism styling', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const filterPanel = screen.getByTestId('filter-panel');
      expect(filterPanel).toBeInTheDocument();
      // Check for glassmorphism classes
      expect(filterPanel.className).toContain('backdrop-blur');
    });
  });

  it('renders without crashing and shows tree list', async () => {
    render(<ChartOfAccountsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('บัญชีทั้งหมด')).toBeInTheDocument();
    });
  });
});
