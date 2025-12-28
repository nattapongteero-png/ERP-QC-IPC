/**
 * Matching Tolerances Settings Page UI Tests (T122)
 * Part of 011-accounting-spec-gap - User Story 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  usePathname: () => '/settings/matching-tolerances',
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
  Button: ({ text, onClick, icon }: any) => (
    <button
      onClick={onClick}
      data-testid={icon === 'plus' ? 'new-tolerance-btn' : icon === 'edit' ? 'edit-btn' : `dx-button-${text?.toLowerCase().replace(/\s+/g, '-')}`}
    >
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

vi.mock('devextreme-react/text-box', () => ({
  TextBox: ({ value, onValueChanged, placeholder }: any) => (
    <input
      data-testid="tolerance-name-input"
      type="text"
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      placeholder={placeholder}
    />
  ),
}));

vi.mock('devextreme-react/number-box', () => ({
  NumberBox: ({ value, onValueChanged }: any) => (
    <input
      data-testid="tolerance-value-input"
      type="number"
      value={value}
      onChange={(e) => onValueChanged?.({ value: parseFloat(e.target.value) })}
    />
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, onValueChanged, items }: any) => (
    <select
      data-testid="tolerance-type-select"
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    >
      {items?.map((item: any) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme-react/switch', () => ({
  Switch: ({ value, onValueChanged }: any) => (
    <input
      data-testid="tolerance-active-switch"
      type="checkbox"
      checked={value}
      onChange={(e) => onValueChanged?.({ value: e.target.checked })}
    />
  ),
}));

vi.mock('devextreme-react/data-grid', () => ({
  default: ({ dataSource, children }: any) => (
    <div data-testid="tolerances-grid">
      <table>
        <tbody>
          {dataSource?.map((item: any, index: number) => (
            <tr key={item.id || index}>
              <td>{item.name}</td>
              <td>{item.quantityTolerancePct}%</td>
              <td>{item.priceTolerancePct}%</td>
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
  FilterRow: () => null,
  Toolbar: ({ children }: any) => <div data-testid="grid-toolbar">{children}</div>,
  Item: ({ children }: any) => <div>{children}</div>,
}));

// Mock data
const mockTolerances = [
  {
    id: 1,
    name: 'Default Tolerance',
    isDefault: true,
    quantityTolerancePct: 5,
    quantityToleranceAbs: 0,
    priceTolerancePct: 2,
    priceToleranceAbs: 0,
    totalTolerancePct: 5,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'High Tolerance',
    isDefault: false,
    quantityTolerancePct: 10,
    quantityToleranceAbs: 0,
    priceTolerancePct: 5,
    priceToleranceAbs: 0,
    totalTolerancePct: 10,
    isActive: true,
    createdAt: '2024-01-02T00:00:00Z',
  },
];

// Mock fetch
global.fetch = vi.fn();

describe('Matching Tolerances Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/settings/matching-tolerances')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockTolerances }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: false, error: 'Not found' }),
      });
    });
  });

  it('should render page title', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Matching Tolerances');
    });
  });

  it('should show loading indicator initially', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    expect(screen.getByTestId('load-indicator')).toBeInTheDocument();
  });

  it('should fetch tolerances on mount', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/matching-tolerances');
    });
  });

  it('should render tolerances grid after loading', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tolerances-grid')).toBeInTheDocument();
    });
  });

  it('should display info box about 3-way matching', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    await waitFor(() => {
      expect(screen.getByText('About 3-Way Matching')).toBeInTheDocument();
    });
  });

  it('should render within MainLayout', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });

  it('should display new tolerance button', async () => {
    const MatchingTolerancesPage = (await import('@/app/settings/matching-tolerances/page')).default;
    render(<MatchingTolerancesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('new-tolerance-btn')).toBeInTheDocument();
    });
  });
});
