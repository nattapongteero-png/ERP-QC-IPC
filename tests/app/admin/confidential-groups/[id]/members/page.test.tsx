/**
 * Group Members Page Tests
 * Verifies the members management page renders correctly with proper UI elements
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GroupMembersPage from '@/app/admin/confidential-groups/[id]/members/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({
    id: '1',
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => (
    <div data-testid="members-grid" {...props}>
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  Sorting: () => null,
  HeaderFilter: () => null,
  LoadPanel: () => null,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, ...props }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick} {...props}>
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  default: ({ ...props }) => <select data-testid={props['data-testid']} />,
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock DxPopup and DxConfirmDialog
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ children, visible }: { children?: React.ReactNode; visible: boolean }) =>
    visible ? <div data-testid="add-member-dialog">{children}</div> : null,
  DxConfirmDialog: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid="confirm-dialog">Confirm Remove</div> : null,
}));

// Mock useMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useMobile: () => ({ isMobile: false, isTablet: false }),
}));

// Mock data
const mockGroup = {
  id: 1,
  code: 'RND_TEAM',
  name: 'R&D Team',
  description: 'Research and Development team',
  memberCount: 2,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const mockMembers = [
  {
    id: 1,
    groupId: 1,
    userId: 101,
    userName: 'John Doe',
    userEmail: 'john@example.com',
    addedAt: '2024-01-15T10:00:00Z',
    addedBy: 1,
  },
  {
    id: 2,
    groupId: 1,
    userId: 102,
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
    addedAt: '2024-01-16T10:00:00Z',
    addedBy: 1,
  },
];

const mockUsers = [
  { id: 101, name: 'John Doe', email: 'john@example.com', role: 'user' },
  { id: 102, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
  { id: 103, name: 'Bob Wilson', email: 'bob@example.com', role: 'admin' },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/members')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockMembers }),
      });
    }
    if (url.includes('/api/admin/confidential-groups/1')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockGroup }),
      });
    }
    if (url.includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockUsers }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  });
});

describe('GroupMembersPage', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it('renders the page title with group name', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Group Members - R&D Team');
    });
  });

  it('renders the add member button', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('add-member-btn')).toBeInTheDocument();
  });

  it('renders the back button', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('back-btn')).toBeInTheDocument();
  });

  it('renders the members data grid', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('members-grid')).toBeInTheDocument();
  });

  it('renders the breadcrumb navigation', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders refresh button', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
  });

  it('fetches group info on mount', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/confidential-groups/1');
    });
  });

  it('fetches members on mount', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/confidential-groups/1/members');
    });
  });

  it('displays group info card with group details', async () => {
    render(<GroupMembersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('RND_TEAM')).toBeInTheDocument();
    });
  });
});
