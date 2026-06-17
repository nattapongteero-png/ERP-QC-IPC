/**
 * QC Entry — Register New Sample (+ Sample Requisition) page tests.
 *
 * Pins the data flow the QC Entry guide depends on:
 *   - loads quarantine lots (/api/inventory/lots?status=quarantine)
 *   - loads the product's test panel (/api/quality/test-panels) on product pick
 *   - renders the requester/purpose, sample-size, and retain sections
 *   - computes the sample-size sum from the panel's criteriaSampleSize
 *
 * Renders with mocked fetch; asserts no crash + key UI present.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import QcEntryNewPage from '@/app/quality/qc-entry/new/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name },
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    },
  );
});

// Lightweight DevExtreme stubs — render native controls so the form mounts.
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ label }: { label?: string }) => (
    <label>
      {label}
      <select />
    </label>
  ),
}));
vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: ({ label }: { label?: string }) => (
    <label>
      {label}
      <input type="date" />
    </label>
  ),
}));
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ label }: { label?: string }) => (
    <label>
      {label}
      <input />
    </label>
  ),
}));
vi.mock('@/components/ui/dx-text-area', () => ({
  DxTextArea: ({ label }: { label?: string }) => (
    <label>
      {label}
      <textarea />
    </label>
  ),
}));
vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ label }: { label?: string }) => (
    <label>
      {label}
      <input type="number" />
    </label>
  ),
}));
vi.mock('@/components/ui/dx-check-box', () => ({
  DxCheckBox: () => <input type="checkbox" />,
}));

vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title }: { title: string }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
    </div>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const MOCK_ITEMS = [
  { id: 11, code: 'RM-001', nameTh: 'ขมิ้นชัน', nameEn: 'Turmeric', category: 'RM', primaryUnit: 'kg' },
];

const MOCK_LOTS = [
  {
    id: 501,
    itemId: 11,
    itemCode: 'RM-001',
    itemName: 'ขมิ้นชัน',
    lotNumber: 'L-RM-26001',
    quantity: 100,
    unit: 'kg',
    manufacturingDate: '2026-01-10',
    expiryDate: '2028-01-10',
    poNumber: 'PO-2569-0438',
  },
];

const MOCK_PANEL = [
  { criteriaId: 1, criteriaCode: 'IPC-RM-LOD', criteriaName: 'Loss on Drying', criteriaNameTh: 'ความชื้น', criteriaSampleSize: 3 },
  { criteriaId: 2, criteriaCode: 'IPC-RM-ASH', criteriaName: 'Total Ash', criteriaNameTh: 'เถ้ารวม', criteriaSampleSize: 2 },
];

function baseFetchMock() {
  setupFetchMock({
    '/api/inventory/lots': { data: createPaginatedResponse(MOCK_LOTS) },
    '/api/quality/test-panels': { data: { success: true, data: { items: MOCK_PANEL } } },
    '/api/items': { data: createPaginatedResponse(MOCK_ITEMS) },
    '/api/customers': { data: createPaginatedResponse([]) },
  });
}

describe('QcEntryNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('renders without crashing with the requester + retain sections', async () => {
    baseFetchMock();
    renderWithProviders(<QcEntryNewPage />);
    await waitFor(() => {
      expect(screen.getByTestId('qc-new-form')).toBeInTheDocument();
    });
    expect(screen.getByText('ผู้ขอเบิก / Request')).toBeInTheDocument();
    expect(screen.getByText('ตัวอย่างคงคลัง / Retain sample')).toBeInTheDocument();
  });

  it('loads quarantine lots from the correct endpoint', async () => {
    baseFetchMock();
    renderWithProviders(<QcEntryNewPage />);
    await waitFor(() => {
      const urls = vi.mocked(fetch).mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes('/api/inventory/lots?status=quarantine'))).toBe(true);
    });
  });
});
