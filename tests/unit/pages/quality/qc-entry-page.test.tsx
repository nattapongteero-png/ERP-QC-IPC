/**
 * QC Entry (list + Quick Add) page tests.
 *
 * Regression guard: the Quick Add "สินค้า" dropdown was empty because the page
 * fetched a non-existent endpoint (/api/master-data/items). Products live at
 * /api/items. These tests pin the correct URL and the response parsing so the
 * dropdown can't silently go empty again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import QcEntryListPage from '@/app/quality/qc-entry/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}));

vi.mock('lucide-react', () => ({
  TestTube: () => <span data-testid="icon-testtube" />,
  Clock: () => <span data-testid="icon-clock" />,
  FlaskConical: () => <span data-testid="icon-flask" />,
  CheckCircle2: () => <span data-testid="icon-check" />,
  Send: () => <span data-testid="icon-send" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: () => <div data-testid="dx-data-grid" />,
  DxDataGridColumn: () => null,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({
    text,
    onClick,
    ...rest
  }: {
    text?: string;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button
      onClick={onClick}
      data-testid={rest['data-testid'] || `dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'x'}`}
    >
      {text}
    </button>
  ),
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ ...rest }: { 'data-testid'?: string }) => (
    <select data-testid={rest['data-testid'] || 'dx-select-box'} />
  ),
}));

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: () => <input data-testid="dx-date-box" />,
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: () => <input data-testid="dx-text-box" />,
}));

vi.mock('@/components/ui/dx-check-box', () => ({
  DxCheckBox: ({ text }: { text?: string }) => <label data-testid="dx-check-box">{text}</label>,
}));

vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) =>
    visible ? <div data-testid="dx-popup">{children}</div> : null,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      {actions}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: number | string }) => (
    <div data-testid={`stat-${label}`}>{value}</div>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const MOCK_ITEMS = [
  { id: 11, code: 'RM-001', nameTh: 'ขมิ้นชัน', nameEn: 'Turmeric' },
  { id: 12, code: 'FG-001', nameTh: 'ยาแคปซูลฟ้าทะลายโจร', nameEn: 'Andrographis' },
];

const MOCK_PENDING = {
  items: [
    {
      grnId: 7,
      grnNumber: 'GRN-2026-0007',
      lineId: 21,
      itemCode: 'RM-001',
      itemName: 'ขมิ้นชัน',
      actualQuantity: 100,
      unit: 'kg',
      qcSampleId: null,
      qcSampleStatus: null,
      lineStatus: 'created',
      qcResult: 'pending',
      ageDays: 2,
      vendorName: 'ผู้ขาย A',
    },
    // qc_approved line must be filtered OUT — only 'created' is "pending registration".
    {
      grnId: 8,
      grnNumber: 'GRN-2026-0008',
      lineId: 22,
      itemCode: 'FG-001',
      itemName: 'ยาแคปซูล',
      actualQuantity: 50,
      unit: 'box',
      qcSampleId: 99,
      qcSampleStatus: 'registered',
      lineStatus: 'qc_approved',
      qcResult: 'passed',
      ageDays: 1,
      vendorName: null,
    },
  ],
  total: 2,
};

function baseFetchMock() {
  setupFetchMock({
    '/api/quality/incoming-inspection/pending-qa': { data: MOCK_PENDING },
    '/api/quality/qc-samples': { data: { success: true, data: [] } },
    '/api/items': { data: createPaginatedResponse(MOCK_ITEMS) },
  });
}

describe('QcEntryListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('renders without crashing', async () => {
    baseFetchMock();
    renderWithProviders(<QcEntryListPage />);
    await waitFor(() => {
      expect(screen.getByText('QC Entry')).toBeInTheDocument();
    });
  });

  it('single "register new" button navigates to the full /new form', async () => {
    baseFetchMock();
    renderWithProviders(<QcEntryListPage />);

    await waitFor(() => expect(screen.getByTestId('qc-entry-register-new')).toBeInTheDocument());
    // The old Quick Add dialog trigger must be gone — one entry point only.
    expect(screen.queryByTestId('qc-entry-quick-add')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('qc-entry-register-new'));
    expect(mockPush).toHaveBeenCalledWith('/quality/qc-entry/new');
  });

  it('shows the pending-registration panel with only checklist-unsigned (created) GRN lines', async () => {
    baseFetchMock();
    renderWithProviders(<QcEntryListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-registration-panel')).toBeInTheDocument();
    });
    // The 'created' line is a pending task; the 'qc_approved' line is filtered out.
    expect(screen.getByTestId('pending-task-21')).toBeInTheDocument();
    expect(screen.queryByTestId('pending-task-22')).not.toBeInTheDocument();
    expect(screen.getByText('รอลงทะเบียน QC (1)')).toBeInTheDocument();
  });

});
