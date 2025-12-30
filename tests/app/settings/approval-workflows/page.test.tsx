/**
 * Approval Workflows Page Tests
 * Verifies the list page renders correctly with proper UI elements
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ApprovalWorkflowsPage from '@/app/settings/approval-workflows/page';

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
    <div data-testid="workflows-grid" {...props}>
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

vi.mock('devextreme-react/text-box', () => ({
  default: ({ ...props }) => <input type="text" data-testid={props['data-testid']} />,
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock fetch
const mockFlows = [
  {
    id: 1,
    name: 'Test Workflow 1',
    description: 'Test description',
    documentType: 'purchase_requisition',
    priority: 100,
    isActive: true,
    rules: [],
    steps: [],
  },
  {
    id: 2,
    name: 'Test Workflow 2',
    description: 'Another test',
    documentType: 'purchase_order',
    priority: 200,
    isActive: false,
    rules: [{ id: 1 }],
    steps: [{ id: 1 }],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: mockFlows }),
  });
});

describe('ApprovalWorkflowsPage', () => {
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
    render(<ApprovalWorkflowsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Approval Workflows');
  });

  it('renders the new workflow button', async () => {
    render(<ApprovalWorkflowsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('new-workflow-btn')).toBeInTheDocument();
  });

  it('renders the filter section', async () => {
    render(<ApprovalWorkflowsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('document-type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
  });

  it('renders the data grid', async () => {
    render(<ApprovalWorkflowsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('workflows-grid')).toBeInTheDocument();
  });

  it('renders refresh button', async () => {
    render(<ApprovalWorkflowsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
  });
});
