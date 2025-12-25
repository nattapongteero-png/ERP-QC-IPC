/**
 * Unit Tests for Work Order Execution Dashboard Page
 * Tests the main execution page that links to all production workflow sub-pages:
 * - Material Weighing
 * - SOP Execution
 * - Environmental Monitoring
 * - Cleaning Checklists
 * - Packaging QC
 * - Finished Inspection
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ id: '1' }),
}));

// Mock work order data
const mockWorkOrder = {
  id: 1,
  woNumber: 'WO-2024-001',
  productId: 1,
  productCode: 'FG001',
  productName: 'ครีมไพล',
  batchNumber: 'BATCH-001',
  plannedQty: 1000,
  actualQty: 950,
  status: 'in_progress',
  plannedStartDate: '2024-12-20',
  plannedEndDate: '2024-12-25',
};

const mockGateStatus = {
  preProduction: { canProceed: true, blockers: [], completedChecks: ['Pre-production cleaning verified'] },
  production: { canProceed: false, blockers: ['2 SOP steps not completed'], completedChecks: [] },
  packaging: { canProceed: false, blockers: ['Pre-packaging cleaning required'], completedChecks: [] },
};

// Mock fetch responses
global.fetch = vi.fn((url) => {
  const urlStr = String(url);

  if (urlStr.includes('/api/production/work-orders/1')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockWorkOrder }),
    });
  }

  if (urlStr.includes('/gate-status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockGateStatus }),
    });
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: [] }),
  });
}) as unknown as typeof fetch;

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    const key = String(queryKey[0]);
    if (key.includes('work-order')) {
      return {
        data: mockWorkOrder,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (key.includes('gate-status')) {
      return {
        data: mockGateStatus,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return {
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/button', () => ({
  default: vi.fn(({ text, onClick, icon, type, disabled }) => (
    <button
      data-testid={`dx-button-${icon || text?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`}
      onClick={onClick}
      disabled={disabled}
      data-type={type}
    >
      {text}
    </button>
  )),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  default: vi.fn(() => (
    <div data-testid="dx-load-indicator">Loading...</div>
  )),
}));

vi.mock('devextreme-react/tabs', () => ({
  default: vi.fn(({ items, selectedIndex, onItemClick }) => (
    <div data-testid="dx-tabs">
      {items?.map((item: { text: string }, index: number) => (
        <button
          key={index}
          data-testid={`tab-${item.text?.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={() => onItemClick?.({ itemIndex: index })}
          data-selected={selectedIndex === index}
        >
          {item.text}
        </button>
      ))}
    </div>
  )),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: vi.fn(({ children, className }) => (
    <div data-testid="card" className={className}>{children}</div>
  )),
  CardHeader: vi.fn(({ children }) => (
    <div data-testid="card-header">{children}</div>
  )),
  CardTitle: vi.fn(({ children }) => (
    <h3 data-testid="card-title">{children}</h3>
  )),
  CardContent: vi.fn(({ children }) => (
    <div data-testid="card-content">{children}</div>
  )),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: vi.fn(({ children, variant }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  )),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: vi.fn(({ text, onClick, icon, type, stylingMode, disabled }) => (
    <button
      data-testid={`dx-button-${icon || text?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`}
      onClick={onClick}
      disabled={disabled}
      data-type={type}
      data-styling={stylingMode}
    >
      {text}
    </button>
  )),
}));

vi.mock('@/components/ui/dx-load-indicator', () => ({
  DxLoadIndicator: vi.fn(() => (
    <div data-testid="dx-load-indicator">Loading...</div>
  )),
}));

vi.mock('@/components/ui/dx-tabs', () => ({
  DxTabs: vi.fn(({ items, selectedIndex, onItemClick }) => (
    <div data-testid="dx-tabs">
      {items?.map((item: { text: string }, index: number) => (
        <button
          key={index}
          data-testid={`tab-${item.text?.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={() => onItemClick?.({ itemIndex: index })}
          data-selected={selectedIndex === index}
        >
          {item.text}
        </button>
      ))}
    </div>
  )),
  DxTabItem: vi.fn(() => null),
}));

// Import the page component after mocks are set up
import ExecutionDashboardPage from '@/app/production/work-orders/[id]/execution/page';

describe('Work Order Execution Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page without crashing', async () => {
      render(<ExecutionDashboardPage />);

      await waitFor(() => {
        // Page should have cards
        expect(screen.getAllByTestId('card').length).toBeGreaterThan(0);
      });
    });

    it('should render the back button', async () => {
      render(<ExecutionDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-back')).toBeInTheDocument();
      });
    });

    it('should render workflow phase cards', async () => {
      render(<ExecutionDashboardPage />);

      await waitFor(() => {
        const cards = screen.getAllByTestId('card');
        expect(cards.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Phase Status Display', () => {
    it('should render work order status', async () => {
      render(<ExecutionDashboardPage />);

      await waitFor(() => {
        // The page renders status as styled span with text
        expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      });
    });

    it('should render production phases', async () => {
      render(<ExecutionDashboardPage />);

      await waitFor(() => {
        // Phase labels should be visible
        expect(screen.getByText('Pre-Production')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is clicked', async () => {
      render(<ExecutionDashboardPage />);

      await waitFor(() => {
        const backButton = screen.getByTestId('dx-button-back');
        backButton.click();
        expect(mockPush).toHaveBeenCalled();
      });
    });
  });
});
