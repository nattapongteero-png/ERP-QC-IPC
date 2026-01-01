/**
 * ApprovalFlowForm Component Tests
 * Verifies the form renders correctly in create and edit modes
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ApprovalFlowForm } from '@/components/settings/ApprovalFlowForm';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children, ...props }: { children?: React.ReactNode; 'data-testid'?: string }) => (
    <div data-testid={props['data-testid']} {...props}>
      {children}
    </div>
  ),
  Column: () => null,
  Editing: () => null,
  RequiredRule: () => null,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, ...props }: { text?: string; onClick?: () => void; 'data-testid'?: string }) => (
    <button onClick={onClick} data-testid={props['data-testid']}>
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/text-box', () => ({
  TextBox: ({ ...props }) => <input type="text" data-testid={props['data-testid']} />,
}));

vi.mock('devextreme-react/text-area', () => ({
  TextArea: ({ ...props }) => <textarea data-testid={props['data-testid']} />,
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ ...props }) => <select data-testid={props['data-testid']} />,
}));

vi.mock('devextreme-react/number-box', () => ({
  NumberBox: ({ ...props }) => <input type="number" data-testid={props['data-testid']} />,
}));

vi.mock('devextreme-react/switch', () => ({
  Switch: ({ ...props }) => <input type="checkbox" data-testid={props['data-testid']} />,
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="load-indicator">Loading...</div>,
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApprovalFlowForm', () => {
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

  describe('Create Mode', () => {
    it('renders the page title for create mode', () => {
      render(<ApprovalFlowForm mode="create" />, { wrapper: createWrapper() });

      expect(screen.getByTestId('page-title')).toHaveTextContent('Create New Workflow');
    });

    it('renders basic form fields', () => {
      render(<ApprovalFlowForm mode="create" />, { wrapper: createWrapper() });

      expect(screen.getByTestId('flow-name')).toBeInTheDocument();
      expect(screen.getByTestId('document-type')).toBeInTheDocument();
      expect(screen.getByTestId('flow-description')).toBeInTheDocument();
    });

    it('renders status and priority fields', () => {
      render(<ApprovalFlowForm mode="create" />, { wrapper: createWrapper() });

      expect(screen.getByTestId('flow-priority')).toBeInTheDocument();
      expect(screen.getByTestId('flow-active')).toBeInTheDocument();
    });

    it('renders add rule and add step buttons', () => {
      render(<ApprovalFlowForm mode="create" />, { wrapper: createWrapper() });

      expect(screen.getByTestId('add-rule-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-step-btn')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<ApprovalFlowForm mode="create" />, { wrapper: createWrapper() });

      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    });

    it('does not render delete button in create mode', () => {
      render(<ApprovalFlowForm mode="create" />, { wrapper: createWrapper() });

      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    const mockFlow = {
      id: 1,
      name: 'Test Workflow',
      description: 'Test description',
      documentType: 'purchase_requisition' as const,
      priority: 100,
      isActive: true,
      rules: [],
      steps: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFlow }),
      });
    });

    it('shows loading indicator while fetching', () => {
      render(<ApprovalFlowForm mode="edit" flowId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('load-indicator')).toBeInTheDocument();
    });

    it('renders the page title for edit mode after loading', async () => {
      render(<ApprovalFlowForm mode="edit" flowId={1} />, { wrapper: createWrapper() });

      // Wait for the data to load
      expect(await screen.findByTestId('page-title')).toHaveTextContent('Edit: Test Workflow');
    });
  });
});
