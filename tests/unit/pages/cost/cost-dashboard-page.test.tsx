/**
 * Cost Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostManagementPage from '@/app/cost/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock DevExtreme SelectBox to prevent actual rendering
vi.mock('devextreme-react/select-box', () => ({
  default: ({ value, onValueChanged, dataSource }: { value?: string; onValueChanged?: (e: { value: string }) => void; dataSource?: unknown[] }) => (
    <select
      data-testid="dx-period-select"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    >
      {Array.isArray(dataSource) && dataSource.map((item: unknown) => {
        const opt = item as { value: string; label: string };
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  ),
}));

// Mock CostDashboard component
vi.mock('@/components/cost/CostDashboard', () => ({
  CostDashboard: ({ periodType }: { periodType?: string }) => (
    <div data-testid="cost-dashboard" data-period={periodType}>
      <div data-testid="cost-dashboard-content">Dashboard Content</div>
    </div>
  ),
}));

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick, 'data-testid': testId }: { children: React.ReactNode; className?: string; onClick?: () => void; 'data-testid'?: string }) => (
    <div data-testid={testId || 'card'} className={className} onClick={onClick}>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

describe('CostManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', () => {
      render(<CostManagementPage />);

      expect(screen.getByTestId('cost-management-page')).toBeInTheDocument();
      expect(screen.getByText('Cost Management')).toBeInTheDocument();
      expect(screen.getByText('Executive dashboard for cost control and margin analysis')).toBeInTheDocument();
    });

    it('should render quick link cards', () => {
      render(<CostManagementPage />);

      expect(screen.getByText('Landed Costs')).toBeInTheDocument();
      expect(screen.getByText('Work Centers')).toBeInTheDocument();
      expect(screen.getByText('Cost Reports')).toBeInTheDocument();
    });

    it('should render quick link descriptions', () => {
      render(<CostManagementPage />);

      expect(screen.getByText('Allocate freight and duties')).toBeInTheDocument();
      expect(screen.getByText('Configure labor rates')).toBeInTheDocument();
      expect(screen.getByText('View detailed reports')).toBeInTheDocument();
    });

    it('should render period selector', () => {
      render(<CostManagementPage />);

      expect(screen.getByTestId('period-selector')).toBeInTheDocument();
      expect(screen.getByTestId('dx-period-select')).toBeInTheDocument();
    });

    it('should render period options', () => {
      render(<CostManagementPage />);

      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
      expect(screen.getByText('This Quarter')).toBeInTheDocument();
    });
  });

  describe('Dashboard Component', () => {
    it('should render cost dashboard component', () => {
      render(<CostManagementPage />);

      expect(screen.getByTestId('cost-dashboard')).toBeInTheDocument();
    });

    it('should pass period type to cost dashboard', () => {
      render(<CostManagementPage />);

      const dashboard = screen.getByTestId('cost-dashboard');
      expect(dashboard).toHaveAttribute('data-period', 'this_month');
    });
  });

  describe('Quick Link Navigation', () => {
    it('should render quick link for landed costs', () => {
      render(<CostManagementPage />);

      expect(screen.getByTestId('quick-link-landed-costs')).toBeInTheDocument();
    });

    it('should render quick link for work centers', () => {
      render(<CostManagementPage />);

      expect(screen.getByTestId('quick-link-work-centers')).toBeInTheDocument();
    });

    it('should render quick link for reports', () => {
      render(<CostManagementPage />);

      expect(screen.getByTestId('quick-link-reports')).toBeInTheDocument();
    });
  });
});
