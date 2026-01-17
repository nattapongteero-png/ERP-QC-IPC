/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReportKPICards, type ReportKPI } from '@/app/accounting/reports/_components/ReportKPICards';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

describe('ReportKPICards', () => {
  const kpis: ReportKPI[] = [
    { labelKey: 'totalDebits', value: 1000000, format: 'currency', status: 'neutral' },
    { labelKey: 'totalCredits', value: 1000000, format: 'currency', status: 'neutral' },
    { labelKey: 'variance', value: 0, format: 'currency', status: 'good' },
  ];

  it('renders all KPI cards', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={kpis} />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('Total Debits')).toBeInTheDocument();
    expect(screen.getByText('Total Credits')).toBeInTheDocument();
    expect(screen.getByText('Variance')).toBeInTheDocument();
  });

  it('formats currency values', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={kpis} />
      </ReportLanguageProvider>
    );
    // Should contain formatted Thai Baht values
    expect(screen.getAllByText(/1,000,000/)).toHaveLength(2);
  });

  it('shows good status with green border', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={kpis} />
      </ReportLanguageProvider>
    );
    const varianceCard = screen.getByTestId('kpi-variance');
    expect(varianceCard).toHaveClass('border-emerald-200');
  });

  it('shows loading state', () => {
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={[]} isLoading />
      </ReportLanguageProvider>
    );
    // Should render skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('formats ratio values with suffix', () => {
    const ratioKpis: ReportKPI[] = [
      { labelKey: 'currentRatio', value: 1.5, format: 'ratio', status: 'good', suffix: 'x' },
    ];
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={ratioKpis} />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('1.50x')).toBeInTheDocument();
  });

  it('formats percent values', () => {
    const percentKpis: ReportKPI[] = [
      { labelKey: 'grossMargin', value: 35.5, format: 'percent', status: 'good' },
    ];
    render(
      <ReportLanguageProvider>
        <ReportKPICards kpis={percentKpis} />
      </ReportLanguageProvider>
    );
    expect(screen.getByText('35.5%')).toBeInTheDocument();
  });
});
