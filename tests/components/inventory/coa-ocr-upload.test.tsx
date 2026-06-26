/**
 * @vitest-environment jsdom
 *
 * UI tests for the CoA OCR upload component. Mocks fetch; verifies it renders,
 * uploads a file, shows the extracted fields, and emits onExtracted on confirm.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Component uses plain <button> (no DevExtreme), so no DevExtreme mock needed.
// lucide-react is already auto-mocked globally in tests/setup.ts.

import { CoaOcrUpload } from '@/components/inventory/coa-ocr-upload';
import type { CoaOcrResult } from '@/types/coa-ocr';

const OK_RESULT: CoaOcrResult = {
  aiUnavailable: false,
  pageCount: 1,
  rawText: 'raw',
  extraction: {
    productName: 'Curcuma Extract',
    supplierItemCode: 'SUP-001',
    lotNumber: 'LOT-2026-01',
    batchNumber: 'B1',
    manufactureDate: '2026-01-10',
    expiryDate: '2028-01-09',
    manufacturerName: 'Herbal Co',
    quantity: '25 kg',
    testResults: [{ parameter: 'Loss on Drying', result: '8.2 %', specification: 'NMT 10 %', pass: true }],
    overallResult: 'pass',
    notes: null,
  },
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

function uploadFile() {
  const input = screen.getByTestId('coa-ocr-file-input') as HTMLInputElement;
  const file = new File(['pdf-bytes'], 'coa.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => vi.restoreAllMocks());

describe('CoaOcrUpload', () => {
  it('renders the upload button without crashing', () => {
    render(<CoaOcrUpload />);
    expect(screen.getByTestId('coa-ocr-upload-button')).toBeInTheDocument();
  });

  it('uploads a file and displays extracted fields', async () => {
    mockFetchOnce(OK_RESULT);
    render(<CoaOcrUpload />);

    uploadFile();

    await waitFor(() => expect(screen.getByTestId('coa-ocr-result')).toBeInTheDocument());
    expect(screen.getByText('Curcuma Extract')).toBeInTheDocument();
    expect(screen.getByText('LOT-2026-01')).toBeInTheDocument();
    expect(screen.getByTestId('coa-ocr-tests')).toBeInTheDocument();
    expect(screen.getByTestId('coa-ocr-overall')).toHaveTextContent('ผ่าน');
  });

  it('emits onExtracted when the operator applies the data', async () => {
    mockFetchOnce(OK_RESULT);
    const onExtracted = vi.fn();
    render(<CoaOcrUpload onExtracted={onExtracted} />);

    uploadFile();
    await waitFor(() => screen.getByTestId('coa-ocr-apply-button'));
    fireEvent.click(screen.getByTestId('coa-ocr-apply-button'));

    expect(onExtracted).toHaveBeenCalledOnce();
    expect(onExtracted.mock.calls[0][0].lotNumber).toBe('LOT-2026-01');
    expect(onExtracted.mock.calls[0][1]).toBe('raw');
  });

  it('shows the unavailable banner when AI is down', async () => {
    mockFetchOnce({ aiUnavailable: true, extraction: null, rawText: null, pageCount: 0, message: 'LLM down' });
    render(<CoaOcrUpload />);

    uploadFile();
    await waitFor(() => expect(screen.getByTestId('coa-ocr-unavailable')).toBeInTheDocument());
    expect(screen.queryByTestId('coa-ocr-result')).not.toBeInTheDocument();
  });

  it('shows an error banner on HTTP failure', async () => {
    mockFetchOnce({ error: 'Forbidden' }, false, 403);
    render(<CoaOcrUpload />);

    uploadFile();
    await waitFor(() => expect(screen.getByTestId('coa-ocr-error')).toBeInTheDocument());
  });
});
