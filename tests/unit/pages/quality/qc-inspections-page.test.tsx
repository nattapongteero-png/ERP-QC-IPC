/**
 * QC Inspections Page — render smoke test.
 *
 * Confirms the page renders without a runtime error and fetches both its
 * inspections and the work-order list used by the "ใบตรวจใหม่" dialog.
 * The WO↔type filtering logic itself is covered in
 * tests/unit/lib/quality/qc-wo-filter.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import QcInspectionsPage from '@/app/quality/qc-inspections/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('lucide-react', () => ({
  ClipboardList: () => <span data-testid="icon-clipboard" />,
  CheckCircle2: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  Clock: () => <span data-testid="icon-clock" />,
  ExternalLink: () => <span data-testid="icon-external" />,
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: () => <div data-testid="dx-data-grid" />,
  DxDataGridColumn: () => null,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick} data-testid={`dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'x'}`}>
      {text}
    </button>
  ),
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: () => <select data-testid="dx-select-box" />,
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: () => <input data-testid="dx-text-box" />,
}));

vi.mock('@/components/ui/dx-text-area', () => ({
  DxTextArea: () => <textarea data-testid="dx-text-area" />,
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

vi.mock('@/components/shared/AttachmentPanel', () => ({
  AttachmentPanel: () => <div data-testid="attachment-panel" />,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const MOCK_WORK_ORDERS = [
  {
    id: 3,
    woNumber: 'WO-2569-003',
    status: 'in_progress',
    productName: 'พาราเซตามอล',
    productCode: 'FG-001',
    batchNumber: 'B123',
  },
];

describe('QcInspectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('renders the page header without crashing', async () => {
    setupFetchMock({
      '/api/quality/qc-inspections': { data: { success: true, data: [] } },
      '/api/production/work-orders': { data: createPaginatedResponse(MOCK_WORK_ORDERS) },
    });

    renderWithProviders(<QcInspectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('ใบตรวจ QC')).toBeInTheDocument();
    });
  });

  it('fetches both inspections and the work-order list on mount', async () => {
    setupFetchMock({
      '/api/quality/qc-inspections': { data: { success: true, data: [] } },
      '/api/production/work-orders': { data: createPaginatedResponse(MOCK_WORK_ORDERS) },
    });

    renderWithProviders(<QcInspectionsPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const urls = vi.mocked(fetch).mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes('/api/quality/qc-inspections'))).toBe(true);
    expect(urls.some((u) => u.includes('/api/production/work-orders'))).toBe(true);
  });

  it('renders even when the work-order list is empty', async () => {
    setupFetchMock({
      '/api/quality/qc-inspections': { data: { success: true, data: [] } },
      '/api/production/work-orders': { data: createPaginatedResponse([]) },
    });

    renderWithProviders(<QcInspectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('ใบตรวจ QC')).toBeInTheDocument();
    });
  });
});
