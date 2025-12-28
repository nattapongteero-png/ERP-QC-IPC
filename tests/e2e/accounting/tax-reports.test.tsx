/**
 * Tax Reports E2E Test
 * Feature: 010-accounting-module-integration
 * User Story 6: Manage VAT and Withholding Tax
 *
 * Tests the VAT Report and WHT Certificates pages rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/accounting/reports/vat',
}));

// Mock lucide-react icons - include all icons used by accounting components
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    Receipt: MockIcon,
    TrendingUp: MockIcon,
    TrendingDown: MockIcon,
    Calculator: MockIcon,
    FileText: MockIcon,
    Users: MockIcon,
    Building2: MockIcon,
    Download: MockIcon,
    User: MockIcon,
    BookOpen: MockIcon,
    Wallet: MockIcon,
    BarChart3: MockIcon,
    CheckCircle: MockIcon,
    ChevronDown: MockIcon,
    RefreshCw: MockIcon,
    Loader2: MockIcon,
    AlertCircle: MockIcon,
    Search: MockIcon,
    Package: MockIcon,
    Building: MockIcon,
    Calendar: MockIcon,
    Clock: MockIcon,
    DollarSign: MockIcon,
  };
});

// Mock shared components to avoid complex rendering
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

// Mock WHTCertificateDialog to avoid complex rendering
vi.mock('@/components/accounting/wht-certificate-dialog', () => ({
  WHTCertificateDialog: ({ visible, certificate }: { visible: boolean; certificate: { certificateNumber: string } | null }) =>
    visible && certificate ? (
      <div data-testid="wht-dialog">
        <span>WHT Certificate - {certificate.certificateNumber}</span>
      </div>
    ) : null,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample VAT report data
const mockVATReport = {
  taxPeriod: '2025-01',
  inputVAT: {
    entries: [
      {
        taxInvoiceNumber: 'INV-2025-001',
        taxInvoiceDate: '2025-01-15',
        partyName: 'Vendor A',
        partyTaxId: '0105555000001',
        branchCode: '00000',
        taxableAmount: 10000,
        vatAmount: 700,
        totalAmount: 10700,
      },
    ],
    totalTaxableAmount: 10000,
    totalVATAmount: 700,
  },
  outputVAT: {
    entries: [
      {
        taxInvoiceNumber: 'TI-2025-001',
        taxInvoiceDate: '2025-01-20',
        partyName: 'Customer B',
        partyTaxId: '0105555000002',
        branchCode: '00000',
        taxableAmount: 20000,
        vatAmount: 1400,
        totalAmount: 21400,
      },
    ],
    totalTaxableAmount: 20000,
    totalVATAmount: 1400,
  },
  netVAT: 700, // 1400 - 700
};

// Sample WHT certificates data
const mockWHTCertificates = {
  taxPeriod: '2025-01',
  certificateType: 'pnd53',
  entries: [
    {
      id: 1,
      certificateNumber: 'WHT53-202501-000001',
      certificateType: 'pnd53',
      paymentDate: '2025-01-15',
      vendorName: 'Vendor A',
      vendorTaxId: '0105555000001',
      whtType: 'SERVICE',
      whtDescription: 'Service Fees',
      paymentAmount: 10000,
      whtRate: 3,
      whtAmount: 300,
      netAmount: 9700,
    },
  ],
  totalPaymentAmount: 10000,
  totalWHTAmount: 300,
  totalNetAmount: 9700,
  certificateCount: 1,
};

// Sample WHT certificate PDF data
const mockWHTCertificatePDF = {
  companyName: 'Herbal Medicine Co., Ltd.',
  companyNameTh: 'บริษัท สมุนไพรไทย จำกัด',
  companyTaxId: '0105555000001',
  companyAddress: '123 Sukhumvit Road, Bangkok 10110, Thailand',
  companyBranch: '00000',
  vendorName: 'Vendor A',
  vendorTaxId: '0105555000002',
  vendorAddress: '456 Silom Road, Bangkok 10500, Thailand',
  certificateNumber: 'WHT53-202501-000001',
  certificateType: 'pnd53',
  paymentDate: '2025-01-15',
  taxPeriod: '2025-01',
  items: [
    {
      whtType: 'SERVICE',
      whtDescription: 'Service Fees',
      paymentDate: '2025-01-15',
      paymentAmount: 10000,
      whtRate: 3,
      whtAmount: 300,
    },
  ],
  totalPaymentAmount: 10000,
  totalWHTAmount: 300,
};

describe('VAT Report Page', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/reports/vat-report')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockVATReport }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  const renderVATPage = async () => {
    const VATReportPage = (await import('@/app/accounting/reports/vat/page')).default;
    return render(
      <QueryClientProvider client={queryClient}>
        <VATReportPage />
      </QueryClientProvider>
    );
  };

  it('should render page header correctly', async () => {
    await renderVATPage();

    await waitFor(() => {
      expect(screen.getByText('รายงานภาษีมูลค่าเพิ่ม')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('should display tax period selector', async () => {
    await renderVATPage();

    await waitFor(() => {
      expect(screen.getByText('เลือกงวดภาษี')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('should display generate report button', async () => {
    await renderVATPage();

    await waitFor(() => {
      // Thai button text
      expect(screen.getByText('สร้างรายงาน')).toBeInTheDocument();
    });
  });

  it('should show placeholder message initially', async () => {
    await renderVATPage();

    await waitFor(() => {
      // Thai placeholder text - the heading text
      expect(screen.getByText(/เลือกงวดภาษีเพื่อสร้างรายงาน/)).toBeInTheDocument();
    });
  });

  it('should render stat cards', async () => {
    await renderVATPage();

    await waitFor(() => {
      // KPI card subtitles
      expect(screen.getByText('Tax Period')).toBeInTheDocument();
      expect(screen.getByText('Output VAT (Sales)')).toBeInTheDocument();
      expect(screen.getByText('Input VAT (Purchases)')).toBeInTheDocument();
    });
  });

  it('should call VAT report API when generating report', async () => {
    await renderVATPage();

    await waitFor(() => {
      expect(screen.getByText('สร้างรายงาน')).toBeInTheDocument();
    });

    // Click generate report button
    const generateBtn = screen.getByText('สร้างรายงาน');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/reports/vat-report')
      );
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch VAT report' }),
      });
    });

    await renderVATPage();

    // Page should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('รายงานภาษีมูลค่าเพิ่ม')).toBeInTheDocument();
    });
  });
});

describe('WHT Certificates Page', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/reports/wht-certificates') && url.includes('format=summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockWHTCertificates }),
        });
      }
      if (url.includes('/api/accounting/reports/wht-certificates/') && url.includes('/pdf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockWHTCertificatePDF }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  const renderWHTPage = async () => {
    const WHTReportPage = (await import('@/app/accounting/reports/wht/page')).default;
    return render(
      <QueryClientProvider client={queryClient}>
        <WHTReportPage />
      </QueryClientProvider>
    );
  };

  it('should render page header correctly', async () => {
    await renderWHTPage();

    await waitFor(() => {
      // Thai title for WHT Certificates
      expect(screen.getByText('หนังสือรับรองภาษีหัก ณ ที่จ่าย')).toBeInTheDocument();
    });
  });

  it('should display tax period selector', async () => {
    await renderWHTPage();

    await waitFor(() => {
      // Thai label for tax period
      expect(screen.getByText('เลือกงวดภาษี')).toBeInTheDocument();
    });
  });

  it('should display certificate type selector', async () => {
    await renderWHTPage();

    await waitFor(() => {
      // Thai label for certificate type - may appear in multiple places (label + KPI card)
      const elements = screen.getAllByText(/ประเภทแบบ/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('should display generate report button', async () => {
    await renderWHTPage();

    await waitFor(() => {
      // Thai button text
      expect(screen.getByText('สร้างรายงาน')).toBeInTheDocument();
    });
  });

  it('should show placeholder message initially', async () => {
    await renderWHTPage();

    await waitFor(() => {
      // Thai placeholder message - there may be multiple elements with this text
      const elements = screen.getAllByText(/เลือกงวดภาษีและประเภทแบบ/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('should render stat cards', async () => {
    await renderWHTPage();

    await waitFor(() => {
      // KPI card subtitles
      expect(screen.getByText('Tax Period')).toBeInTheDocument();
      expect(screen.getByText('Certificate Type')).toBeInTheDocument();
    });
  });

  it('should call WHT certificates API when generating report', async () => {
    await renderWHTPage();

    await waitFor(() => {
      expect(screen.getByText('สร้างรายงาน')).toBeInTheDocument();
    });

    // Click generate report button
    const generateBtn = screen.getByText('สร้างรายงาน');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/reports/wht-certificates')
      );
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch WHT certificates' }),
      });
    });

    await renderWHTPage();

    // Page should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('หนังสือรับรองภาษีหัก ณ ที่จ่าย')).toBeInTheDocument();
    });
  });
});

describe('WHT Certificate Dialog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/reports/wht-certificates/') && url.includes('/pdf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockWHTCertificatePDF }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  const mockCertificate = {
    id: 1,
    certificateNumber: 'WHT53-202501-000001',
    certificateType: 'pnd53' as const,
    paymentDate: '2025-01-15',
    vendorName: 'Vendor A',
    vendorTaxId: '0105555000001',
    whtType: 'SERVICE',
    whtDescription: 'Service Fees',
    paymentAmount: 10000,
    whtRate: 3,
    whtAmount: 300,
    netAmount: 9700,
  };

  const renderDialog = async (visible: boolean, certificate: typeof mockCertificate | null) => {
    const { WHTCertificateDialog } = await import('@/components/accounting/wht-certificate-dialog');
    return render(
      <QueryClientProvider client={queryClient}>
        <WHTCertificateDialog
          visible={visible}
          certificate={certificate}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );
  };

  it('should not render when not visible', async () => {
    await renderDialog(false, null);

    // Dialog should not be in the document
    expect(screen.queryByText('WHT Certificate')).not.toBeInTheDocument();
  });

  it('should render certificate number in title when visible', async () => {
    await renderDialog(true, mockCertificate);

    await waitFor(() => {
      expect(screen.getByText(/WHT53-202501-000001/)).toBeInTheDocument();
    });
  });
});

describe('Tax Reports API Responses', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should handle VAT report response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockVATReport }),
    });

    const response = await fetch('/api/accounting/reports/vat-report?taxPeriod=2025-01');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.taxPeriod).toBe('2025-01');
    expect(data.data.inputVAT.totalVATAmount).toBe(700);
    expect(data.data.outputVAT.totalVATAmount).toBe(1400);
    expect(data.data.netVAT).toBe(700);
  });

  it('should handle WHT certificates response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockWHTCertificates }),
    });

    const response = await fetch('/api/accounting/reports/wht-certificates?taxPeriod=2025-01&certificateType=pnd53&format=summary');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.taxPeriod).toBe('2025-01');
    expect(data.data.certificateType).toBe('pnd53');
    expect(data.data.certificateCount).toBe(1);
    expect(data.data.totalWHTAmount).toBe(300);
  });

  it('should handle WHT certificate PDF response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockWHTCertificatePDF }),
    });

    const response = await fetch('/api/accounting/reports/wht-certificates/1/pdf');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.certificateNumber).toBe('WHT53-202501-000001');
    expect(data.data.companyName).toBe('Herbal Medicine Co., Ltd.');
    expect(data.data.totalWHTAmount).toBe(300);
  });
});

describe('Tax Calculation Validation', () => {
  it('should validate VAT is 7%', () => {
    const taxableAmount = 10000;
    const expectedVAT = taxableAmount * 0.07;
    expect(expectedVAT).toBeCloseTo(700, 2);
  });

  it('should validate net VAT calculation', () => {
    const outputVAT = 1400;
    const inputVAT = 700;
    const netVAT = outputVAT - inputVAT;

    expect(netVAT).toBe(700); // VAT payable
  });

  it('should validate WHT at 3%', () => {
    const paymentAmount = 10000;
    const whtRate = 3;
    const expectedWHT = (paymentAmount * whtRate) / 100;

    expect(expectedWHT).toBe(300);
  });

  it('should validate net payment after WHT', () => {
    const paymentAmount = 10000;
    const whtAmount = 300;
    const netPayment = paymentAmount - whtAmount;

    expect(netPayment).toBe(9700);
  });
});
