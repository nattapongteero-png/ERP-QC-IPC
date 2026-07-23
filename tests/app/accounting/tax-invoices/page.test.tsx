/**
 * Test: Tax Invoice Register Page (ทะเบียนใบกำกับภาษี)
 * List items 30-31 — the screen that surfaces vat_transactions.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TaxInvoicesPage from '@/app/accounting/tax-invoices/page';

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, onValueChanged, 'data-testid': testId }: any) => (
    <select
      data-testid={testId}
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    >
      <option value="output">output</option>
      <option value="input">input</option>
      <option value="">all</option>
    </select>
  ),
}));

vi.mock('devextreme-react/date-box', () => ({
  DateBox: ({ value, onValueChanged }: any) => (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    />
  ),
}));

vi.mock('devextreme-react/data-grid', () => ({
  __esModule: true,
  default: ({ dataSource, children, 'data-testid': testId }: any) => (
    <div data-testid={testId || 'data-grid'}>
      {dataSource?.map((row: any, idx: number) => (
        <div key={idx} data-testid={`grid-row-${idx}`}>
          <span>{row.taxInvoiceNumber}</span>
          <span>{row.partyName}</span>
          <span>{row.partyTaxId}</span>
          <span>{row.vatAmount}</span>
        </div>
      ))}
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  SearchPanel: () => null,
  Summary: () => null,
  TotalItem: () => null,
  Export: () => null,
}));

global.fetch = vi.fn();

const mockRows = [
  {
    id: 1,
    transactionType: 'output',
    taxInvoiceNumber: 'T-202607-000001',
    taxInvoiceDate: '2026-07-01',
    taxPeriod: '202607',
    partyName: 'บริษัท ทดสอบ จำกัด',
    partyTaxId: '0105558123456',
    branchCode: '00000',
    taxableAmount: 4000,
    vatRate: 7,
    vatAmount: 280,
    totalAmount: 4280,
    arInvoiceId: 12,
    apInvoiceId: null,
  },
  {
    id: 2,
    transactionType: 'output',
    taxInvoiceNumber: 'T-202607-000002',
    taxInvoiceDate: '2026-07-05',
    taxPeriod: '202607',
    partyName: 'ห้างหุ้นส่วน สมุนไพรไทย',
    partyTaxId: '0105558999888',
    branchCode: '00000',
    taxableAmount: 16650,
    vatRate: 7,
    vatAmount: 1165.5,
    totalAmount: 17815.5,
    arInvoiceId: 13,
    apInvoiceId: null,
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Tax Invoice Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockRows }),
    });
  });

  it('renders without crashing', async () => {
    render(<TaxInvoicesPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('tax-invoices-page')).toBeInTheDocument();
    });
  });

  it('lists the tax invoices returned by the API', async () => {
    render(<TaxInvoicesPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('T-202607-000001')).toBeInTheDocument();
      expect(screen.getByText('T-202607-000002')).toBeInTheDocument();
    });
  });

  it('shows the party name and tax ID required on a Thai tax invoice', async () => {
    render(<TaxInvoicesPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('บริษัท ทดสอบ จำกัด')).toBeInTheDocument();
      expect(screen.getByText('0105558123456')).toBeInTheDocument();
    });
    // The old bug wrote every row as Unknown/0000000000000.
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('queries the tax-invoices API with the default output filter', async () => {
    render(<TaxInvoicesPage />, { wrapper });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('/api/accounting/tax-invoices');
    expect(url).toContain('transactionType=output');
  });

  it('renders an empty grid when there are no tax invoices', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    render(<TaxInvoicesPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('tax-invoices-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('grid-row-0')).not.toBeInTheDocument();
  });
});
