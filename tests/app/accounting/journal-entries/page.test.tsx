import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JournalEntriesPage from '@/app/accounting/journal-entries/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('JournalEntriesPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders professional page header', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    expect(screen.getByText('รายการบันทึกบัญชี')).toBeInTheDocument();
    expect(screen.getByText('Journal Entries')).toBeInTheDocument();
  });

  it('renders status KPI cards', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
    expect(screen.getByText('ร่าง')).toBeInTheDocument();
    expect(screen.getByText('ผ่านแล้ว')).toBeInTheDocument();
  });

  it('renders data grid with professional styling', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    // Check for grid container instead of grid role
    const gridContainer = document.querySelector('.dx-datagrid');
    expect(gridContainer).toBeInTheDocument();
  });

  it('renders glassmorphism filter panel', async () => {
    render(<JournalEntriesPage />, { wrapper: createWrapper() });
    const filterPanel = screen.getByTestId('filter-panel');
    expect(filterPanel).toBeInTheDocument();
    expect(filterPanel).toHaveClass('backdrop-blur-md');
  });
});
