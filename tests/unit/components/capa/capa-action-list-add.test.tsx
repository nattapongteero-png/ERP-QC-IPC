/**
 * CapaActionList - Add Action Dialog Tests
 *
 * Tests that the Add Action dialog opens without crashing,
 * correctly handles paginated /api/users response,
 * and renders all form fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock UI components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: (props: any) => (
    <button
      data-testid={`btn-${props.text || 'default'}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.text}
    </button>
  ),
}));

vi.mock('@/components/ui/dx-text-area', () => ({
  DxTextArea: (props: any) => (
    <textarea data-testid="textarea" placeholder={props.placeholder} />
  ),
}));

vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: (props: any) => (
    <select data-testid={`select-${props.placeholder || 'default'}`}>
      {(props.items || []).map((item: any, i: number) => (
        <option key={i} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/ui/dx-date-box', () => ({
  DxDateBox: () => <input data-testid="datebox" type="date" />,
}));

vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: (props: any) => {
    if (!props.visible) return null;
    return (
      <div data-testid="popup" role="dialog" aria-label={props.title}>
        {props.children}
      </div>
    );
  },
}));

import { CapaActionList } from '@/components/capa/CapaActionList';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderComponent(props: Partial<Parameters<typeof CapaActionList>[0]> = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CapaActionList
        capaId={1}
        actions={[]}
        canEdit={true}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe('CapaActionList - Add Action Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Add Action button when canEdit is true', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { items: [], total: 0, page: 1, limit: 100, totalPages: 0 } }),
    }) as any;

    renderComponent();
    expect(screen.getByTestId('btn-Add Action')).toBeInTheDocument();
  });

  it('should NOT render Add Action button when canEdit is false', () => {
    renderComponent({ canEdit: false });
    expect(screen.queryByTestId('btn-Add Action')).not.toBeInTheDocument();
  });

  it('should open dialog without crashing when users API returns paginated response', async () => {
    // Mock: /api/users returns paginated response (the bug scenario)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          items: [
            { id: 1, name: 'User One', email: 'user1@test.com', role: 'admin' },
            { id: 2, name: 'User Two', email: 'user2@test.com', role: 'production' },
          ],
          total: 2,
          page: 1,
          limit: 100,
          totalPages: 1,
        },
      }),
    }) as any;

    renderComponent();

    // Click Add Action
    await act(async () => {
      screen.getByTestId('btn-Add Action').click();
    });

    // Dialog should be visible
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    // Should show all form fields
    expect(screen.getByTestId('textarea')).toBeInTheDocument();
    expect(screen.getByTestId('datebox')).toBeInTheDocument();
  });

  it('should handle users API returning non-paginated array', async () => {
    // Some legacy APIs might return a plain array
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'User One' },
        ],
      }),
    }) as any;

    renderComponent();

    await act(async () => {
      screen.getByTestId('btn-Add Action').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });
  });

  it('should handle users API failure gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'Unauthorized' }),
    }) as any;

    renderComponent();

    await act(async () => {
      screen.getByTestId('btn-Add Action').click();
    });

    // Dialog should still open even if users fetch fails
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });
  });

  it('should display existing actions when provided', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { items: [], total: 0 } }),
    }) as any;

    renderComponent({
      actions: [
        {
          id: 1,
          capaId: 1,
          actionNumber: 1,
          description: 'Fix the issue',
          actionType: 'corrective',
          assigneeId: 1,
          assigneeName: 'John',
          status: 'pending',
          dueDate: '2026-04-01',
          completionNotes: null,
          completedAt: null,
          verifiedBy: null,
          verifiedByName: undefined,
          verifiedAt: null,
        },
      ],
    });

    expect(screen.getByText('Action #1')).toBeInTheDocument();
    expect(screen.getByText('Fix the issue')).toBeInTheDocument();
  });
});
