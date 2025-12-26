import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WHTReportPage from '@/app/accounting/reports/wht/page';
import type { WHTCertificateSummary } from '@/types/accounting';

// Mock fetch
global.fetch = vi.fn();

// Mock WHT Report Data
const mockWHTReport: WHTCertificateSummary = {
  taxPeriod: '2024-12',
  certificateType: 'pnd53',
  certificateCount: 3,
  totalPaymentAmount: 100000,
  totalWHTAmount: 3000,
  totalNetAmount: 97000,
  entries: [
    {
      certificateNumber: 'WHT-2024-001',
      paymentDate: new Date('2024-12-15'),
      vendorName: 'ABC Company Ltd.',
      vendorTaxId: '0123456789012',
      whtType: '1',
      whtDescription: 'Service fee',
      paymentAmount: 50000,
      whtRate: 3,
      whtAmount: 1500,
      netAmount: 48500,
    },
    {
      certificateNumber: 'WHT-2024-002',
      paymentDate: new Date('2024-12-20'),
      vendorName: 'XYZ Corporation',
      vendorTaxId: '9876543210987',
      whtType: '2',
      whtDescription: 'Professional fee',
      paymentAmount: 30000,
      whtRate: 5,
      whtAmount: 1500,
      netAmount: 28500,
    },
    {
      certificateNumber: 'WHT-2024-003',
      paymentDate: new Date('2024-12-25'),
      vendorName: 'DEF Limited',
      vendorTaxId: '1234567890123',
      whtType: '1',
      whtDescription: 'Consulting fee',
      paymentAmount: 20000,
      whtRate: 0,
      whtAmount: 0,
      netAmount: 20000,
    },
  ],
};

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

describe('WHT Report Page', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockWHTReport }),
    } as Response);
  });

  it('renders professional page header with file-text icon', () => {
    render(<WHTReportPage />, { wrapper: createWrapper() });
    expect(screen.getByText('หนังสือรับรองภาษีหัก ณ ที่จ่าย')).toBeInTheDocument();
    expect(screen.getByText(/WHT Certificates Report/i)).toBeInTheDocument();
  });

  it('renders WHT summary KPI cards with proper styling', () => {
    render(<WHTReportPage />, { wrapper: createWrapper() });

    // Tax period card
    expect(screen.getByText('งวดภาษี')).toBeInTheDocument();
    expect(screen.getByText('Tax Period')).toBeInTheDocument();

    // Certificate type card - appears in KPI card and filter label
    expect(screen.getAllByText('ประเภทแบบ').length).toBeGreaterThan(0);
    expect(screen.getByText('Certificate Type')).toBeInTheDocument();

    // Certificate count card
    expect(screen.getByText('จำนวนหนังสือ')).toBeInTheDocument();
    expect(screen.getByText('Certificates Count')).toBeInTheDocument();

    // Total WHT card
    expect(screen.getByText('ภาษีหัก ณ ที่จ่าย')).toBeInTheDocument();
    expect(screen.getByText('Total WHT Amount')).toBeInTheDocument();
  });

  it('renders filter panel with glassmorphism styling', () => {
    render(<WHTReportPage />, { wrapper: createWrapper() });
    const filterPanel = screen.getByTestId('filter-panel');
    expect(filterPanel).toHaveClass('backdrop-blur-md');
    expect(screen.getByText('เลือกงวดภาษี')).toBeInTheDocument();
    // ประเภทแบบ appears in both KPI card and filter panel
    expect(screen.getAllByText('ประเภทแบบ').length).toBeGreaterThan(0);
  });

  it('shows empty state before report is generated', () => {
    render(<WHTReportPage />, { wrapper: createWrapper() });
    expect(screen.getByText('เลือกงวดภาษีและประเภทแบบ')).toBeInTheDocument();
    expect(screen.getByText(/เลือกงวดภาษีและประเภทแบบ \(PND 3 \/ PND 53\)/)).toBeInTheDocument();
  });

  it('displays WHT data with enhanced styling when report is loaded', async () => {
    const { container } = render(<WHTReportPage />, { wrapper: createWrapper() });

    // Click generate report button
    const generateButton = screen.getByText('สร้างรายงาน');
    generateButton.click();

    // Wait for report data to load - check for header first
    await waitFor(
      () => {
        expect(screen.getByText(/หนังสือรับรองภาษีหัก ณ ที่จ่าย - PND 53/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Wait for grid data to render
    await waitFor(
      () => {
        expect(screen.getByText('ABC Company Ltd.')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Check certificates grid section
    expect(screen.getByText('ABC Company Ltd.')).toBeInTheDocument();

    // Check summary panel
    expect(screen.getByText('สรุปภาษีหัก ณ ที่จ่าย')).toBeInTheDocument();
    expect(screen.getByText('จำนวนหนังสือรับรอง')).toBeInTheDocument();
    expect(screen.getByText('จำนวนเงินจ่าย')).toBeInTheDocument();
    // จำนวนเงินสุทธิ appears in both grid column and summary panel
    expect(screen.getAllByText('จำนวนเงินสุทธิ').length).toBeGreaterThan(0);

    // Check for gradient backgrounds
    const gradientSections = container.querySelectorAll('.bg-gradient-to-r, .bg-gradient-to-br');
    expect(gradientSections.length).toBeGreaterThan(0);
  });
});
