/**
 * Credit/Debit Notes NEW page — dropdown shape fix (#2)
 *
 * /api/customers + /api/vendors return paginated `{ data: { items: [...] } }`.
 * Verifies the page unwraps `.data.items` so the customer / vendor SelectBoxes
 * receive their options (previously broke when code read `.data` as an array).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/accounting/credit-debit-notes/new',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// SelectBox mock — renders its items as <option> elements so the test can
// assert what reached the dropdown. The wrapper testid is derived from the
// placeholder (the customer/vendor boxes have no data-testid of their own).
vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ items = [], displayExpr, placeholder, value, onValueChanged }: any) => {
    const testid =
      placeholder === 'เลือกลูกค้า'
        ? 'customer-select'
        : placeholder === 'เลือกผู้ขาย'
        ? 'vendor-select'
        : placeholder === 'เลือกประเภทใบ'
        ? 'note-type-select'
        : placeholder === 'เลือกใบแจ้งหนี้'
        ? 'invoice-select'
        : 'select-box';
    return (
      <select
        data-testid={testid}
        value={value ?? ''}
        onChange={(e) => onValueChanged?.({ value: e.target.value })}
      >
        <option value="">{placeholder}</option>
        {items.map((it: any, i: number) => (
          <option key={i} value={it.value ?? it.id}>
            {displayExpr ? it[displayExpr] : it.label}
          </option>
        ))}
      </select>
    );
  },
}));

vi.mock('devextreme-react/date-box', () => ({
  DateBox: () => <input data-testid="date-box" />,
}));
vi.mock('devextreme-react/number-box', () => ({
  NumberBox: () => <input data-testid="number-box" />,
}));
vi.mock('devextreme-react/text-area', () => ({
  TextArea: () => <textarea data-testid="text-area" />,
}));
vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="load-indicator" />,
}));
vi.mock('devextreme-react/data-grid', () => {
  const DataGrid = ({ children }: any) => <div data-testid="line-grid">{children}</div>;
  return {
    default: DataGrid,
    Column: () => null,
    Editing: () => null,
    Lookup: () => null,
  };
});
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, ...props }: any) => (
    <button data-testid={props['data-testid']} onClick={onClick}>{text}</button>
  ),
}));

// Real-world paginated responses (matches /api/customers + /api/vendors shape)
const customersPaginated = {
  success: true,
  data: {
    items: [
      { id: 11, code: 'CUST-001', name: 'โรงพยาบาลสมุนไพรอภัยภูเบศร', isActive: true },
      { id: 12, code: 'CUST-002', name: 'คลินิกแพทย์แผนไทย เชียงใหม่', isActive: true },
    ],
    total: 2,
    page: 1,
    limit: 1000,
    totalPages: 1,
  },
};
const vendorsPaginated = {
  success: true,
  data: {
    items: [
      { id: 21, code: 'V-ACME', name: 'ACME Herbal Supplies Co.', isActive: true },
      { id: 22, code: 'V-THAIHERB', name: 'ไทยเฮิร์บ วัตถุดิบสมุนไพร', isActive: true },
    ],
    total: 2,
    page: 1,
    limit: 1000,
    totalPages: 1,
  },
};

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/customers')) {
      return Promise.resolve({ json: () => Promise.resolve(customersPaginated) });
    }
    if (url.includes('/api/vendors')) {
      return Promise.resolve({ json: () => Promise.resolve(vendorsPaginated) });
    }
    if (url.includes('/api/accounting/gl-accounts')) {
      return Promise.resolve({
        json: () => Promise.resolve({ success: true, data: [{ id: 1, code: '5100', nameTh: 'ซื้อ' }] }),
      });
    }
    if (url.includes('/api/accounting/credit-debit-notes/invoices')) {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
  });
}

import NewNotePage from '@/app/accounting/credit-debit-notes/new/page';

describe('Credit/Debit Notes NEW page — paginated dropdown shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it('renders without crashing and shows note-type select', async () => {
    render(<NewNotePage />);
    await waitFor(() => {
      expect(screen.getByTestId('note-type-select')).toBeInTheDocument();
    });
  });

  it('fetches customers + vendors with limit=1000 on mount', async () => {
    render(<NewNotePage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/customers?isActive=true&limit=1000');
      expect(global.fetch).toHaveBeenCalledWith('/api/vendors?isActive=true&limit=1000');
    });
  });

  it('populates customer SelectBox from .data.items when noteType is ar_*', async () => {
    render(<NewNotePage />);
    // wait for master data load
    await waitFor(() => expect(screen.getByTestId('note-type-select')).toBeInTheDocument());

    // pick an AR note type -> reveals customer select
    const noteSelect = screen.getByTestId('note-type-select') as HTMLSelectElement;
    await act(async () => {
      noteSelect.value = 'ar_credit';
      noteSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      const customerSelect = screen.getByTestId('customer-select');
      // 2 customers + placeholder option
      expect(customerSelect.querySelectorAll('option')).toHaveLength(3);
    });
    expect(screen.getByText('โรงพยาบาลสมุนไพรอภัยภูเบศร')).toBeInTheDocument();
    expect(screen.getByText('คลินิกแพทย์แผนไทย เชียงใหม่')).toBeInTheDocument();
  });

  it('populates vendor SelectBox from .data.items when noteType is ap_*', async () => {
    render(<NewNotePage />);
    await waitFor(() => expect(screen.getByTestId('note-type-select')).toBeInTheDocument());

    const noteSelect = screen.getByTestId('note-type-select') as HTMLSelectElement;
    await act(async () => {
      noteSelect.value = 'ap_debit';
      noteSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      const vendorSelect = screen.getByTestId('vendor-select');
      expect(vendorSelect.querySelectorAll('option')).toHaveLength(3);
    });
    expect(screen.getByText('ACME Herbal Supplies Co.')).toBeInTheDocument();
    expect(screen.getByText('ไทยเฮิร์บ วัตถุดิบสมุนไพร')).toBeInTheDocument();
  });
});
