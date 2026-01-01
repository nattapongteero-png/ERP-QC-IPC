/**
 * Matching Tolerances Settings Page UI Tests (T122)
 * Part of 011-accounting-spec-gap - User Story 4
 * Updated to support TanStack Query and template pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

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
  usePathname: () => '/settings/matching-tolerances',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock MainLayout (used by layout.tsx)
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock TemplatePageHeader
vi.mock('@/components/template', () => ({
  TemplatePageHeader: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1 data-testid="page-title">{title}</h1>
      {subtitle && <p data-testid="page-subtitle">{subtitle}</p>}
      <div data-testid="header-actions">{actions}</div>
    </div>
  ),
}));

// Mock ui/card
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, icon, type }: { text?: string; onClick?: () => void; icon?: string; type?: string }) => (
    <button
      onClick={onClick}
      data-testid={type === 'success' ? 'new-tolerance-btn' : `dx-button-${text?.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  default: ({ value, dataSource, displayExpr, valueExpr }: { value: string; dataSource: { value: string; label: string }[]; displayExpr: string; valueExpr: string }) => (
    <select
      data-testid="select-box"
      value={value}
    >
      {dataSource?.map((item: { value: string; label: string }) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme-react/text-box', () => ({
  default: ({ value, placeholder }: { value: string; placeholder?: string }) => (
    <input
      data-testid="search-input"
      type="text"
      value={value}
      placeholder={placeholder}
      readOnly
    />
  ),
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

interface ToleranceItem {
  id: number;
  name: string;
  toleranceType: string;
  toleranceValue: number;
  isActive: boolean;
}

vi.mock('devextreme-react/data-grid', () => ({
  default: ({ dataSource, children }: { dataSource: ToleranceItem[]; children: React.ReactNode }) => (
    <div data-testid="tolerances-grid">
      <table>
        <tbody>
          {dataSource?.map((item, index) => (
            <tr key={item.id || index}>
              <td>{item.name}</td>
              <td>{item.toleranceType}</td>
              <td>{item.toleranceValue}%</td>
              <td>{item.isActive ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  Sorting: () => null,
  Selection: () => null,
  HeaderFilter: () => null,
  LoadPanel: () => null,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  Filter: () => <span>Filter</span>,
  Eye: () => <span>Eye</span>,
  Edit: () => <span>Edit</span>,
  Trash2: () => <span>Trash</span>,
}));

// Mock data matching the new MatchingTolerance interface
const mockTolerances = [
  {
    id: 1,
    name: 'Default Quantity Tolerance',
    description: 'Default tolerance for quantity matching',
    toleranceType: 'quantity',
    toleranceMethod: 'percentage',
    toleranceValue: 5,
    priority: 10,
    isActive: true,
    createdBy: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Price Tolerance',
    description: 'Tolerance for price matching',
    toleranceType: 'price',
    toleranceMethod: 'percentage',
    toleranceValue: 2,
    priority: 20,
    isActive: true,
    createdBy: 1,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

// Mock fetch
global.fetch = vi.fn();

describe('Matching Tolerances Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/settings/matching-tolerances')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockTolerances, total: 2, page: 1, limit: 100, totalPages: 1 }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false, error: 'Not found' }),
      });
    });
  });

  it('should render page title', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Matching Tolerances');
    });
  });

  it('should fetch tolerances on mount', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings/matching-tolerances')
      );
    });
  });

  it('should render tolerances grid after loading', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('tolerances-grid')).toBeInTheDocument();
    });
  });

  it('should display info box about 3-way matching', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('About 3-Way Matching')).toBeInTheDocument();
    });
  });

  it('should display page header with subtitle', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-subtitle')).toHaveTextContent(
        'Configure tolerance thresholds for 3-way matching validation'
      );
    });
  });

  it('should display new tolerance button', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('new-tolerance-btn')).toBeInTheDocument();
    });
  });

  it('should display filter section', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Filters:')).toBeInTheDocument();
    });
  });
});
