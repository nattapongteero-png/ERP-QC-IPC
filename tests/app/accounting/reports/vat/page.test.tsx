import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VATReportPage from '@/app/accounting/reports/vat/page';
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
  Wrapper.displayName = 'TestQueryClientProvider';
  return Wrapper;
};

const mockVATReport = {
  outputVAT: {
    totalVATAmount: 35000,
    entries: [
      {
        taxInvoiceNumber: 'IV-2024-001',
        taxInvoiceDate: '2024-12-01',
        partyName: 'ABC Company Ltd.',
        partyTaxId: '0123456789012',
        branchCode: '00000',
        taxableAmount: 500000,
        vatAmount: 35000,
        totalAmount: 535000,
      },
    ],
  },
  inputVAT: {
    totalVATAmount: 14000,
    entries: [
      {
        taxInvoiceNumber: 'PV-2024-001',
        taxInvoiceDate: '2024-12-05',
        partyName: 'XYZ Supplier Co.',
        partyTaxId: '0987654321098',
        branchCode: '00001',
        taxableAmount: 200000,
        vatAmount: 14000,
        totalAmount: 214000,
      },
    ],
  },
  netVAT: 21000,
};

describe('VATReportPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockVATReport }),
    } as Response);
  });

  it('renders professional page header with receipt icon', () => {
    render(<VATReportPage />, { wrapper: createWrapper() });
    expect(screen.getByText('รายงานภาษีมูลค่าเพิ่ม')).toBeInTheDocument();
    expect(screen.getByText(/VAT Report \(Por Por 30\)/i)).toBeInTheDocument();
  });

  it('renders VAT summary KPI cards with proper styling', () => {
    render(<VATReportPage />, { wrapper: createWrapper() });

    // Tax period card
    expect(screen.getByText('งวดภาษี')).toBeInTheDocument();
    expect(screen.getByText('Tax Period')).toBeInTheDocument();

    // Output VAT card
    expect(screen.getByText('ภาษีขาออก')).toBeInTheDocument();
    expect(screen.getByText('Output VAT (Sales)')).toBeInTheDocument();

    // Input VAT card
    expect(screen.getByText('ภาษีขาเข้า')).toBeInTheDocument();
    expect(screen.getByText('Input VAT (Purchases)')).toBeInTheDocument();

    // Net VAT card
    expect(screen.getByText('ภาษีสุทธิ')).toBeInTheDocument();
  });

  it('renders filter panel with glassmorphism styling', () => {
    render(<VATReportPage />, { wrapper: createWrapper() });
    const filterPanel = screen.getByTestId('filter-panel');
    expect(filterPanel).toHaveClass('backdrop-blur-md');
    expect(screen.getByText('เลือกงวดภาษี')).toBeInTheDocument();
  });

  it('shows empty state before report is generated', () => {
    render(<VATReportPage />, { wrapper: createWrapper() });
    expect(screen.getByText('เลือกงวดภาษีเพื่อสร้างรายงาน')).toBeInTheDocument();
    expect(screen.getByText(/เลือกงวดภาษีจากด้านบนแล้วคลิก/)).toBeInTheDocument();
  });

  it('displays VAT data with enhanced styling when report is loaded', async () => {
    const { container } = render(<VATReportPage />, { wrapper: createWrapper() });

    // Click generate report button
    const generateButton = screen.getByText('สร้างรายงาน');
    generateButton.click();

    // Wait for report data to load
    await waitFor(() => {
      expect(screen.getByText('ภาษีขาออก (ภาษีจากการขาย)')).toBeInTheDocument();
    });

    // Check Output VAT section
    expect(screen.getByText('ภาษีขาออก (ภาษีจากการขาย)')).toBeInTheDocument();

    // Check Input VAT section
    expect(screen.getByText('ภาษีขาเข้า (ภาษีจากการซื้อ)')).toBeInTheDocument();

    // Check summary panel
    expect(screen.getByText('สรุปภาษีมูลค่าเพิ่ม')).toBeInTheDocument();

    // Check for gradient backgrounds
    const gradientSections = container.querySelectorAll('.bg-gradient-to-r');
    expect(gradientSections.length).toBeGreaterThan(0);
  });
});
