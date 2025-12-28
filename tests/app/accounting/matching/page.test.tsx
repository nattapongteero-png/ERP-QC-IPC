/**
 * 3-Way Matching Exceptions Page UI Tests (T122)
 * Part of 011-accounting-spec-gap - User Story 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/accounting/matching',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, icon, hint }: any) => (
    <button onClick={onClick} title={hint} data-testid={`dx-button-${icon || text?.toLowerCase().replace(/\s+/g, '-')}`}>
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="load-indicator">Loading...</div>,
}));

vi.mock('devextreme-react/popup', () => ({
  Popup: ({ visible, children, title }: any) =>
    visible ? (
      <div data-testid="popup" role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock('devextreme-react/text-area', () => ({
  TextArea: ({ value, onValueChanged, placeholder }: any) => (
    <textarea
      data-testid="review-comments-input"
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      placeholder={placeholder}
    />
  ),
}));

vi.mock('devextreme-react/data-grid', () => ({
  default: ({ dataSource, children }: any) => (
    <div data-testid="exceptions-grid">
      <table>
        <tbody>
          {dataSource?.map((item: any, index: number) => (
            <tr key={item.id || index}>
              <td>{item.id}</td>
              <td>{item.exceptionType}</td>
              <td>{item.varianceAmount}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  FilterRow: () => null,
  Toolbar: ({ children }: any) => <div data-testid="grid-toolbar">{children}</div>,
  Item: ({ children }: any) => <div>{children}</div>,
  SearchPanel: () => null,
}));

// Mock data
const mockExceptions = [
  {
    id: 1,
    matchingResultId: 1,
    exceptionType: 'quantity_variance',
    varianceAmount: 100,
    variancePct: 5.5,
    status: 'pending',
    resolutionAction: null,
    resolutionNotes: null,
    resolvedBy: null,
    resolvedByName: null,
    resolvedAt: null,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    matchingResultId: 1,
    exceptionType: 'price_variance',
    varianceAmount: -50,
    variancePct: 2.5,
    status: 'approved',
    resolutionAction: 'approved',
    resolutionNotes: 'Price adjusted',
    resolvedBy: 1,
    resolvedByName: 'Admin User',
    resolvedAt: '2024-01-16T11:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
  },
];

const mockSummary = {
  totalMatchedToday: 15,
  totalExceptionsToday: 3,
  pendingExceptions: 5,
  matchedThisMonth: 120,
};

// Mock fetch
global.fetch = vi.fn();

describe('Matching Exceptions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/accounting/matching/exceptions')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockExceptions }),
        });
      }
      if (url.includes('/api/accounting/matching')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockSummary }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: false, error: 'Not found' }),
      });
    });
  });

  it('should render page title', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Matching Exceptions');
    });
  });

  it('should show loading indicator initially', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    // Loading should show briefly
    expect(screen.getByTestId('load-indicator')).toBeInTheDocument();
  });

  it('should fetch exceptions on mount', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/matching/exceptions');
    });
  });

  it('should fetch summary on mount', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/matching');
    });
  });

  it('should render exceptions grid after loading', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('exceptions-grid')).toBeInTheDocument();
    });
  });

  it('should display summary dashboard cards', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Matched Today')).toBeInTheDocument();
      expect(screen.getByText('Exceptions Today')).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText('Matched This Month')).toBeInTheDocument();
    });
  });

  it('should render within MainLayout', async () => {
    const MatchingExceptionsPage = (await import('@/app/accounting/matching/page')).default;
    render(<MatchingExceptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });
});
