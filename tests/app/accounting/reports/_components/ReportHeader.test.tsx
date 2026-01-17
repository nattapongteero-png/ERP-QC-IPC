/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReportHeader } from '@/app/accounting/reports/_components/ReportHeader';
import { ReportLanguageProvider } from '@/contexts/report-language-context';

function renderWithProvider(ui: React.ReactElement) {
  return render(<ReportLanguageProvider>{ui}</ReportLanguageProvider>);
}

describe('ReportHeader', () => {
  it('renders title and subtitle', () => {
    renderWithProvider(
      <ReportHeader
        titleKey="trialBalance"
        subtitle="As of 2026-01-17"
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    expect(screen.getByText('As of 2026-01-17')).toBeInTheDocument();
  });

  it('toggles language when clicked', () => {
    renderWithProvider(
      <ReportHeader titleKey="trialBalance" onRefresh={() => {}} />
    );
    const toggle = screen.getByTestId('language-toggle');
    fireEvent.click(toggle);
    expect(screen.getByText('งบทดลอง')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn();
    renderWithProvider(
      <ReportHeader titleKey="trialBalance" onRefresh={onRefresh} />
    );
    fireEvent.click(screen.getByTestId('refresh-button'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows loading state when isLoading is true', () => {
    renderWithProvider(
      <ReportHeader titleKey="trialBalance" onRefresh={() => {}} isLoading />
    );
    const button = screen.getByTestId('refresh-button');
    expect(button).toBeDisabled();
  });
});
