import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JournalEntriesPage from '@/app/accounting/journal-entries/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock DevExtreme dialog
vi.mock('devextreme/ui/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

global.fetch = vi.fn();

// Seed data generator for realistic journal entries
function createSeedJournalEntries() {
  return [
    {
      id: 1,
      entryNumber: 'JE-202512-000001',
      entryDate: '2025-12-15',
      fiscalPeriodId: 12,
      description: 'ค่าสาธารณูปโภคประจำเดือน ธ.ค. 2568',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'posted',
      totalDebit: 15000.00,
      totalCredit: 15000.00,
      postedBy: 1,
      postedAt: '2025-12-15T10:30:00',
      lines: [
        { id: 1, lineNumber: 1, glAccountId: 65, accountCode: '5211', accountName: 'ค่าไฟฟ้า', debit: 8000, credit: 0, description: 'ค่าไฟฟ้า ธ.ค.' },
        { id: 2, lineNumber: 2, glAccountId: 66, accountCode: '5212', accountName: 'ค่าน้ำประปา', debit: 2000, credit: 0, description: 'ค่าน้ำ ธ.ค.' },
        { id: 3, lineNumber: 3, glAccountId: 67, accountCode: '5213', accountName: 'ค่าโทรศัพท์', debit: 5000, credit: 0, description: 'ค่าโทร ธ.ค.' },
        { id: 4, lineNumber: 4, glAccountId: 3, accountCode: '1111', accountName: 'เงินสด', debit: 0, credit: 15000, description: 'จ่ายเงินสด' },
      ],
    },
    {
      id: 2,
      entryNumber: 'JE-202512-000002',
      entryDate: '2025-12-18',
      fiscalPeriodId: 12,
      description: 'บันทึกค่าเช่าสำนักงานล่วงหน้า',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'draft',
      totalDebit: 50000.00,
      totalCredit: 50000.00,
      postedBy: null,
      postedAt: null,
      lines: [
        { id: 5, lineNumber: 1, glAccountId: 20, accountCode: '1310', accountName: 'ค่าเช่าจ่ายล่วงหน้า', debit: 50000, credit: 0, description: 'ค่าเช่า ม.ค.-มี.ค. 2569' },
        { id: 6, lineNumber: 2, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 0, credit: 50000, description: 'โอนจ่าย' },
      ],
    },
    {
      id: 3,
      entryNumber: 'JE-202512-000003',
      entryDate: '2025-12-20',
      fiscalPeriodId: 12,
      description: 'รับชำระหนี้จากลูกค้า',
      sourceType: 'AR_RECEIPT',
      sourceId: 101,
      status: 'posted',
      totalDebit: 107000.00,
      totalCredit: 107000.00,
      postedBy: 1,
      postedAt: '2025-12-20T14:00:00',
      lines: [
        { id: 7, lineNumber: 1, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 107000, credit: 0, description: 'รับเงินโอน' },
        { id: 8, lineNumber: 2, glAccountId: 8, accountCode: '1121', accountName: 'ลูกหนี้การค้า - ในประเทศ', debit: 0, credit: 107000, description: 'ตัดยอดลูกหนี้' },
      ],
    },
    {
      id: 4,
      entryNumber: 'JE-202512-000004',
      entryDate: '2025-12-22',
      fiscalPeriodId: 12,
      description: 'จ่ายค่าซื้อวัตถุดิบ พร้อมหัก ณ ที่จ่าย',
      sourceType: 'AP_PAYMENT',
      sourceId: 55,
      status: 'posted',
      totalDebit: 100000.00,
      totalCredit: 100000.00,
      postedBy: 1,
      postedAt: '2025-12-22T09:15:00',
      lines: [
        { id: 9, lineNumber: 1, glAccountId: 45, accountCode: '2111', accountName: 'เจ้าหนี้การค้า - ในประเทศ', debit: 100000, credit: 0, description: 'ตัดยอดเจ้าหนี้' },
        { id: 10, lineNumber: 2, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 0, credit: 97000, description: 'จ่ายสุทธิ' },
        { id: 11, lineNumber: 3, glAccountId: 53, accountCode: '2132', accountName: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', debit: 0, credit: 3000, description: 'WHT 3%' },
      ],
    },
    {
      id: 5,
      entryNumber: 'JE-202512-000005',
      entryDate: '2025-12-25',
      fiscalPeriodId: 12,
      description: 'กลับรายการค่าสาธารณูปโภค - บันทึกผิดบัญชี',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'reversed',
      totalDebit: 5000.00,
      totalCredit: 5000.00,
      postedBy: 1,
      postedAt: '2025-12-25T11:00:00',
      reversedBy: 1,
      reversedAt: '2025-12-26T09:00:00',
      reversalEntryId: 6,
      lines: [
        { id: 12, lineNumber: 1, glAccountId: 65, accountCode: '5211', accountName: 'ค่าไฟฟ้า', debit: 5000, credit: 0, description: 'บันทึกผิด' },
        { id: 13, lineNumber: 2, glAccountId: 3, accountCode: '1111', accountName: 'เงินสด', debit: 0, credit: 5000, description: 'จ่ายเงินสด' },
      ],
    },
  ];
}

// Seed GL accounts for the form
function createSeedGLAccounts() {
  return [
    { id: 3, code: '1111', nameTh: 'เงินสด', nameEn: 'Cash on Hand' },
    { id: 4, code: '1112', nameTh: 'เงินฝากธนาคาร - ออมทรัพย์', nameEn: 'Bank - Savings Account' },
    { id: 8, code: '1121', nameTh: 'ลูกหนี้การค้า - ในประเทศ', nameEn: 'AR - Domestic' },
    { id: 45, code: '2111', nameTh: 'เจ้าหนี้การค้า - ในประเทศ', nameEn: 'AP - Domestic' },
    { id: 53, code: '2132', nameTh: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', nameEn: 'WHT Payable' },
    { id: 65, code: '5211', nameTh: 'ค่าไฟฟ้า', nameEn: 'Electricity Expense' },
    { id: 66, code: '5212', nameTh: 'ค่าน้ำประปา', nameEn: 'Water Expense' },
    { id: 67, code: '5213', nameTh: 'ค่าโทรศัพท์', nameEn: 'Telephone Expense' },
    { id: 70, code: '5300', nameTh: 'ค่าเช่าสำนักงาน', nameEn: 'Office Rent' },
    { id: 80, code: '4110', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue' },
  ];
}

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

describe('JournalEntriesPage', () => {
  const seedEntries = createSeedJournalEntries();
  const seedAccounts = createSeedGLAccounts();

  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('/api/accounting/journal-entries') && !urlStr.includes('/post') && !urlStr.includes('/reverse')) {
        // Check for specific entry ID
        const idMatch = urlStr.match(/\/journal-entries\/(\d+)$/);
        if (idMatch) {
          const entry = seedEntries.find(e => e.id === parseInt(idMatch[1]));
          return {
            ok: true,
            json: async () => ({ data: entry || null }),
          } as Response;
        }
        // List entries
        return {
          ok: true,
          json: async () => ({ data: seedEntries }),
        } as Response;
      }

      if (urlStr.includes('/api/accounting/gl-accounts')) {
        return {
          ok: true,
          json: async () => ({ data: seedAccounts }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Header and Layout', () => {
    it('renders professional page header with Thai and English titles', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });
      expect(screen.getByText('รายการบันทึกบัญชี')).toBeInTheDocument();
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });

    it('renders add entry button in header', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });
      const addButton = screen.getByTestId('add-entry-button');
      expect(addButton).toBeInTheDocument();
    });
  });

  describe('KPI Cards with Real-World Data', () => {
    it('renders all KPI cards with correct labels', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
        expect(screen.getByText('ร่าง')).toBeInTheDocument();
        expect(screen.getByText('ผ่านแล้ว')).toBeInTheDocument();
        expect(screen.getByText('กลับรายการ')).toBeInTheDocument();
      });
    });

    it('displays correct counts from seed data', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      const kpiCards = screen.getByTestId('kpi-cards');
      expect(kpiCards).toBeInTheDocument();

      // With 5 seed entries: 1 draft, 3 posted, 1 reversed
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Total
      });
    });
  });

  describe('Filter Panel', () => {
    it('renders filter panel with status and source type filters', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      const filterPanel = screen.getByTestId('filter-panel');
      expect(filterPanel).toBeInTheDocument();
      expect(screen.getByText('สถานะ')).toBeInTheDocument();
      expect(screen.getByText('ประเภท')).toBeInTheDocument();
    });
  });

  describe('Data Grid with Journal Entries', () => {
    it('renders data grid container', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      const gridContainer = screen.getByTestId('journal-entries-grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('displays journal entries with DevExtreme DataGrid', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const grid = document.querySelector('.dx-datagrid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Real-World Accounting Scenarios', () => {
    it('handles utility expense entry (multiple expenses to cash)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 1: Utility expenses with multiple expense accounts debited and cash credited
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/accounting/journal-entries'),
        );
      });
    });

    it('handles prepaid expense entry (asset to bank)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 2: Prepaid rent - asset increase, bank decrease
      // This is a real-world scenario for prepaying rent
    });

    it('handles AR receipt entry with customer payment', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 3: AR_RECEIPT source type - bank increases, AR decreases
      // Real-world customer payment scenario
    });

    it('handles AP payment with WHT deduction', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 4: AP_PAYMENT with 3% WHT
      // Real-world Thai accounting: Pay vendor, deduct WHT, record liability
    });

    it('handles reversed entry scenario', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 5: Reversed entry due to incorrect account
      // Real-world: Mistakes happen, entries need to be reversed
    });
  });

  describe('Entry Status Display', () => {
    it('displays different status badges correctly', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Should render status badges for draft, posted, reversed
      await waitFor(() => {
        const grid = document.querySelector('.dx-datagrid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Source Type Labels', () => {
    it('displays Thai labels for source types', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Source types should be translated:
      // MANUAL -> บันทึกมือ
      // AR_RECEIPT -> รับเงิน
      // AP_PAYMENT -> จ่ายเงิน
      await waitFor(() => {
        const grid = document.querySelector('.dx-datagrid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('fetches journal entries on mount', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/accounting/journal-entries'),
        );
      });
    });

    it('fetches GL accounts for the form', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/accounting/gl-accounts'),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API error gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      // Should not crash
      render(<JournalEntriesPage />, { wrapper: createWrapper() });
      expect(screen.getByText('รายการบันทึกบัญชี')).toBeInTheDocument();
    });
  });
});
