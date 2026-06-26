/**
 * PRApprovalTimeline Component Test
 *
 * Verifies the PR action timeline renders without runtime errors and shows
 * who performed each step (created → approved/rejected) with names + comments,
 * using mocked /history fetch responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PRApprovalTimeline } from '@/components/purchasing/PRApprovalTimeline';
import type { PRTimelineEntry } from '@/types/purchase-requisition';

// Stub lucide-react icons via Proxy so any icon name resolves to a span.
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

// Stub the DevExtreme LoadIndicator (heavy, irrelevant to assertions).
vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="load-indicator" />,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const timeline: PRTimelineEntry[] = [
  {
    type: 'created',
    stepOrder: 0,
    stepName: 'created',
    actorName: 'Alice Recorder',
    actionDate: '2026-06-20T03:00:00.000Z',
    comments: null,
  },
  {
    type: 'approved',
    stepOrder: 1,
    stepName: 'approved',
    actorName: 'Bob Approver',
    actionDate: '2026-06-21T05:30:00.000Z',
    comments: 'Looks good, approved.',
  },
];

function mockHistory(data: PRTimelineEntry[]) {
  mockFetch.mockResolvedValue({
    json: async () => ({ success: true, data }),
  });
}

describe('PRApprovalTimeline', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('renders without crashing and shows the timeline container', async () => {
    mockHistory(timeline);
    render(<PRApprovalTimeline prId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('pr-approval-timeline')).toBeInTheDocument();
    });
  });

  it('shows the actor name for each step (created + approved)', async () => {
    mockHistory(timeline);
    render(<PRApprovalTimeline prId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Alice Recorder')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob Approver')).toBeInTheDocument();
    // The approval comment is surfaced.
    expect(screen.getByText('Looks good, approved.')).toBeInTheDocument();
  });

  it('calls the history endpoint with the PR id', async () => {
    mockHistory(timeline);
    render(<PRApprovalTimeline prId={42} />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/purchasing/requisitions/42/history');
    });
  });

  it('shows an empty state when there is no history', async () => {
    mockHistory([]);
    render(<PRApprovalTimeline prId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('pr-timeline-empty')).toBeInTheDocument();
    });
  });

  it('shows an error state when the fetch fails', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ success: false, error: 'boom' }) });
    render(<PRApprovalTimeline prId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('pr-timeline-error')).toBeInTheDocument();
    });
  });

  it('falls back to a placeholder when the actor name is blank', async () => {
    mockHistory([
      { type: 'pending', stepOrder: 1, stepName: 'pending_approval', actorName: '', actionDate: null, comments: null },
    ]);
    render(<PRApprovalTimeline prId={1} />);
    await waitFor(() => {
      // English fallback for timeline.noActor is "Unknown".
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});
