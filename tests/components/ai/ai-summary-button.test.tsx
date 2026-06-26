/**
 * @vitest-environment jsdom
 *
 * UI tests for AiSummaryButton. Plain <button> + lucide (auto-mocked in setup).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiSummaryButton } from '@/components/ai/ai-summary-button';

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

beforeEach(() => vi.restoreAllMocks());

describe('AiSummaryButton', () => {
  it('renders the trigger button', () => {
    render(<AiSummaryButton endpoint="/api/x/summary" />);
    expect(screen.getByTestId('ai-summary-button')).toBeInTheDocument();
  });

  it('fetches and shows the summary on click', async () => {
    mockFetch({ summary: 'สรุปทดสอบ', aiUnavailable: false });
    render(<AiSummaryButton endpoint="/api/x/summary" />);

    fireEvent.click(screen.getByTestId('ai-summary-button'));

    await waitFor(() => expect(screen.getByTestId('ai-summary-result')).toBeInTheDocument());
    expect(screen.getByText('สรุปทดสอบ')).toBeInTheDocument();
  });

  it('unwraps a {data:...} envelope', async () => {
    mockFetch({ data: { summary: 'wrapped', aiUnavailable: false } });
    render(<AiSummaryButton endpoint="/api/x/summary" />);
    fireEvent.click(screen.getByTestId('ai-summary-button'));
    await waitFor(() => expect(screen.getByText('wrapped')).toBeInTheDocument());
  });

  it('shows the unavailable banner when aiUnavailable', async () => {
    mockFetch({ summary: null, aiUnavailable: true });
    render(<AiSummaryButton endpoint="/api/x/summary" />);
    fireEvent.click(screen.getByTestId('ai-summary-button'));
    await waitFor(() => expect(screen.getByTestId('ai-summary-unavailable')).toBeInTheDocument());
  });

  it('shows an error banner on HTTP failure', async () => {
    mockFetch({ error: 'boom' }, false, 500);
    render(<AiSummaryButton endpoint="/api/x/summary" />);
    fireEvent.click(screen.getByTestId('ai-summary-button'));
    await waitFor(() => expect(screen.getByTestId('ai-summary-error')).toBeInTheDocument());
  });
});
