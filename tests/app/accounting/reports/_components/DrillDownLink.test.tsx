/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DrillDownLink } from '@/app/accounting/reports/_components/DrillDownLink';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

describe('DrillDownLink', () => {
  it('renders formatted currency value', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={1000000}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
        />
      </ReportLanguageProvider>
    );
    expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
  });

  it('renders link with correct href', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={500000}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
        />
      </ReportLanguageProvider>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/accounting/gl-accounts/1110?from=2026-01-01&to=2026-01-31');
  });

  it('shows dash without link when value is zero', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={0}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
        />
      </ReportLanguageProvider>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <ReportLanguageProvider>
        <DrillDownLink
          value={1000}
          accountCode="1110"
          fromDate="2026-01-01"
          toDate="2026-01-31"
          className="custom-class"
        />
      </ReportLanguageProvider>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveClass('custom-class');
  });
});
