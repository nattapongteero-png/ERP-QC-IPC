/**
 * WithdrawalPanel — eBMR history card.
 *
 * Confirms the panel renders the WO's extra-withdrawal history (request id,
 * reason, status badge) and opens the detail dialog when a row is clicked.
 * Approval issues stock immediately, so an approved row reads "จ่ายของแล้ว".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { WithdrawalPanel } from '@/components/production/withdrawal-panel';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

// Child dialogs/banner are out of scope — stub them to observe open state only.
vi.mock('@/components/production/material-withdrawal-request-dialog', () => ({
  MaterialWithdrawalRequestDialog: () => <div data-testid="request-dialog" />,
}));
vi.mock('@/components/production/material-withdrawal-detail-dialog', () => ({
  MaterialWithdrawalDetailDialog: ({ visible, requestId }: { visible: boolean; requestId: number | null }) =>
    visible ? <div data-testid="detail-dialog">detail:{requestId}</div> : null,
}));
vi.mock('@/components/production/phase-block-banner', () => ({
  PhaseBlockBanner: () => <div data-testid="phase-banner" />,
}));

const HISTORY = [
  {
    id: 7,
    workOrderId: 5,
    factoryCode: null,
    status: 'approved',
    reasonType: 'machine_setup_loss',
    requestedAt: '2026-06-02T03:00:00.000Z',
    requestedBy: { id: 2, name: 'Production Manager' },
    itemCount: 1,
  },
  {
    id: 8,
    workOrderId: 5,
    factoryCode: null,
    status: 'pending',
    reasonType: 'equipment_trial_run',
    requestedAt: '2026-06-02T04:00:00.000Z',
    requestedBy: { id: 2, name: 'Production Manager' },
    itemCount: 2,
  },
];

function mockApis(history: unknown[]) {
  setupFetchMock({
    '/api/production/work-orders/5/materials': { data: [] },
    '/api/master-data/production-rooms': { data: { data: [] } },
    '/api/material-withdrawal/requests': { data: { items: history, total: history.length, page: 1, pageSize: 50 } },
  });
}

describe('WithdrawalPanel — history card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('lists the WO withdrawal history with status badges', async () => {
    mockApis(HISTORY);
    renderWithProviders(<WithdrawalPanel workOrderId={5} />);

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-history')).toBeInTheDocument();
    });
    // Approved row reads "จ่ายของแล้ว"; pending row reads "รออนุมัติ".
    expect(screen.getByText(/อนุมัติ — จ่ายของแล้ว/)).toBeInTheDocument();
    expect(screen.getByText(/รออนุมัติ/)).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-history-7')).toBeInTheDocument();
    expect(screen.getByTestId('withdrawal-history-8')).toBeInTheDocument();
  });

  it('opens the detail dialog when a history row is clicked', async () => {
    mockApis(HISTORY);
    renderWithProviders(<WithdrawalPanel workOrderId={5} />);

    await waitFor(() => expect(screen.getByTestId('withdrawal-history-7')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('withdrawal-history-7'));

    await waitFor(() => {
      expect(screen.getByTestId('detail-dialog')).toHaveTextContent('detail:7');
    });
  });

  it('renders nothing for the history block when there are no requests', async () => {
    mockApis([]);
    renderWithProviders(<WithdrawalPanel workOrderId={5} />);

    // Panel still renders, but no history block.
    await waitFor(() => expect(screen.getByTestId('withdrawal-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('withdrawal-history')).not.toBeInTheDocument();
  });
});
