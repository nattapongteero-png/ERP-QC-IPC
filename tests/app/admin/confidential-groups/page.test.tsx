/**
 * Confidential Access Groups Page Tests
 * Verifies the page renders correctly with proper UI elements
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConfidentialAccessGroupsPage from '@/app/admin/confidential-groups/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children, ...props }: { children?: React.ReactNode }) => (
    <div data-testid="groups-grid" {...props}>
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

vi.mock('devextreme-react/text-box', () => ({
  default: ({ ...props }) => <input type="text" data-testid={props['data-testid']} />,
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock DxPopup and DxConfirmDialog
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ children, visible }: { children?: React.ReactNode; visible: boolean }) =>
    visible ? <div data-testid="form-dialog">{children}</div> : null,
  DxConfirmDialog: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid="confirm-dialog">Confirm Delete</div> : null,
}));

// Mock useMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useMobile: () => ({ isMobile: false, isTablet: false }),
}));

// Mock fetch
const mockGroups = [
  {
    id: 1,
    code: 'RND_TEAM',
    name: 'R&D Team',
    description: 'Research and Development team',
    memberCount: 5,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    code: 'PRODUCTION_MGMT',
    name: 'Production Management',
    description: 'Production management team',
    memberCount: 3,
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: mockGroups }),
  });
});

describe('ConfidentialAccessGroupsPage', () => {
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

  it('renders the page title', async () => {
    render(<ConfidentialAccessGroupsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Confidential Access Groups');
  });

  it('renders the add group button', async () => {
    render(<ConfidentialAccessGroupsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('add-group-btn')).toBeInTheDocument();
  });

  it('renders the search input', async () => {
    render(<ConfidentialAccessGroupsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('renders the data grid', async () => {
    render(<ConfidentialAccessGroupsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('groups-grid')).toBeInTheDocument();
  });

  it('renders refresh button', async () => {
    render(<ConfidentialAccessGroupsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
  });

  it('fetches confidential access groups on mount', async () => {
    render(<ConfidentialAccessGroupsPage />, { wrapper: createWrapper() });

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/confidential-groups');
  });
});
