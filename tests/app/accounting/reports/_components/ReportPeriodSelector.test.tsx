/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReportPeriodSelector } from '@/app/accounting/reports/_components/ReportPeriodSelector';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

// Mock DevExtreme DateBox
vi.mock('devextreme-react/date-box', () => ({
  DateBox: ({ 'data-testid': testId }: { 'data-testid': string }) => (
    <input data-testid={testId} type="date" />
  ),
}));

describe('ReportPeriodSelector', () => {
  it('renders as-of-date mode', () => {
    const onDateChange = vi.fn();
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="asOfDate"
          asOfDate="2026-01-17"
          onAsOfDateChange={onDateChange}
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('as-of-date-picker')).toBeInTheDocument();
  });

  it('renders period range mode', () => {
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="periodRange"
          periodStart="2026-01-01"
          periodEnd="2026-01-31"
          onPeriodStartChange={() => {}}
          onPeriodEndChange={() => {}}
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('period-start-picker')).toBeInTheDocument();
    expect(screen.getByTestId('period-end-picker')).toBeInTheDocument();
  });

  it('renders quick presets for as-of-date mode', () => {
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="asOfDate"
          asOfDate="2026-01-17"
          onAsOfDateChange={() => {}}
          showPresets
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Month End')).toBeInTheDocument();
    expect(screen.getByText('Quarter End')).toBeInTheDocument();
    expect(screen.getByText('Year End')).toBeInTheDocument();
  });

  it('renders quick presets for period range mode', () => {
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="periodRange"
          periodStart="2026-01-01"
          periodEnd="2026-01-31"
          onPeriodStartChange={() => {}}
          onPeriodEndChange={() => {}}
          showPresets
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('Last Month')).toBeInTheDocument();
    expect(screen.getByText('This Quarter')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
  });

  it('renders generate button when onGenerate provided', () => {
    const onGenerate = vi.fn();
    render(
      <ReportLanguageProvider>
        <ReportPeriodSelector
          mode="asOfDate"
          asOfDate="2026-01-17"
          onAsOfDateChange={() => {}}
          onGenerate={onGenerate}
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
  });
});
