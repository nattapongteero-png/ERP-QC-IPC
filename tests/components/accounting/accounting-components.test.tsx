import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
  AccountingMiniChart,
} from '@/components/accounting';

describe('Accounting UI Components', () => {
  describe('AccountingPageHeader', () => {
    it('renders title and subtitle', () => {
      render(
        <AccountingPageHeader
          title="Chart of Accounts"
          subtitle="Manage GL accounts"
          icon="book"
        />
      );
      expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
      expect(screen.getByText('Manage GL accounts')).toBeInTheDocument();
    });

    it('renders period selector when provided', () => {
      render(
        <AccountingPageHeader
          title="Reports"
          currentPeriod="December 2024"
          periodStatus="open"
        />
      );
      expect(screen.getByText('December 2024')).toBeInTheDocument();
    });
  });

  describe('AccountingKPICard', () => {
    it('renders value and label with trend', () => {
      render(
        <AccountingKPICard
          label="Cash Balance"
          value="฿1,234,567"
          trend="up"
          trendValue="+12.5%"
          icon="wallet"
          variant="success"
        />
      );
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
      expect(screen.getByText('฿1,234,567')).toBeInTheDocument();
      expect(screen.getByText('+12.5%')).toBeInTheDocument();
    });

    it('renders mini sparkline when data provided', () => {
      render(
        <AccountingKPICard
          label="Revenue"
          value="฿5,000,000"
          sparklineData={[100, 120, 150, 130, 180, 200]}
        />
      );
      expect(screen.getByTestId('sparkline-chart')).toBeInTheDocument();
    });
  });

  describe('AccountingStatusBadge', () => {
    it('renders correct status styles', () => {
      const { rerender } = render(<AccountingStatusBadge status="draft" />);
      expect(screen.getByText('ร่าง')).toHaveClass('bg-gray-100');

      rerender(<AccountingStatusBadge status="posted" />);
      expect(screen.getByText('ผ่านแล้ว')).toHaveClass('bg-green-100');

      rerender(<AccountingStatusBadge status="overdue" />);
      expect(screen.getByText('ค้างชำระ')).toHaveClass('bg-red-100');
    });
  });

  describe('AccountingFilterPanel', () => {
    it('renders filter controls in glassmorphism panel', () => {
      render(
        <AccountingFilterPanel>
          <div data-testid="filter-child">Filter Content</div>
        </AccountingFilterPanel>
      );
      expect(screen.getByTestId('filter-child')).toBeInTheDocument();
      expect(screen.getByTestId('filter-panel')).toHaveClass('backdrop-blur-md');
    });
  });

  describe('AccountingMiniChart', () => {
    it('renders line chart with data', () => {
      render(
        <AccountingMiniChart
          data={[{ value: 100 }, { value: 150 }, { value: 120 }]}
          type="line"
          color="#22c55e"
        />
      );
      expect(screen.getByTestId('mini-chart')).toBeInTheDocument();
    });
  });
});
