/**
 * Tests for the supplier CoA OCR extraction service.
 * Mocks the AI adapter layer so no network is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ocrExtractFromFile = vi.fn();
const llmCompleteJson = vi.fn();

vi.mock('@/lib/services/ai', () => ({
  ocr: { extractFromFile: (...a: unknown[]) => ocrExtractFromFile(...a) },
  llm: { completeJson: (...a: unknown[]) => llmCompleteJson(...a) },
}));

import { extractCoaFromFile, extractCoaFromText } from '@/lib/services/coa-ocr.service';

const SAMPLE_EXTRACTION = {
  productName: 'Curcuma Extract',
  supplierItemCode: 'SUP-001',
  lotNumber: 'LOT-2026-01',
  batchNumber: 'B123',
  manufactureDate: '2026-01-10',
  expiryDate: '2028-01-09',
  manufacturerName: 'Herbal Co',
  quantity: '25 kg',
  testResults: [
    { parameter: 'Loss on Drying', result: '8.2 %', specification: 'NMT 10 %', pass: true },
    { parameter: 'Heavy Metals', result: '15 ppm', specification: 'NMT 10 ppm', pass: false },
  ],
  overallResult: 'fail',
  notes: 'Heavy metals out of spec',
};

beforeEach(() => {
  ocrExtractFromFile.mockReset();
  llmCompleteJson.mockReset();
});

describe('extractCoaFromFile', () => {
  it('runs OCR then LLM and returns normalized extraction', async () => {
    ocrExtractFromFile.mockResolvedValue({ text: 'CoA text...', pages: [{}, {}] });
    llmCompleteJson.mockResolvedValue(SAMPLE_EXTRACTION);

    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const result = await extractCoaFromFile(blob, 'coa.pdf', { backend: 'chandra' });

    // OCR called with markdown + chosen backend
    expect(ocrExtractFromFile).toHaveBeenCalledOnce();
    const ocrOpts = ocrExtractFromFile.mock.calls[0][2];
    expect(ocrOpts).toMatchObject({ fmt: 'markdown', backend: 'chandra' });

    expect(result.aiUnavailable).toBe(false);
    expect(result.pageCount).toBe(2);
    expect(result.extraction?.lotNumber).toBe('LOT-2026-01');
    expect(result.extraction?.testResults).toHaveLength(2);
    expect(result.extraction?.overallResult).toBe('fail');
  });

  it('returns aiUnavailable when OCR yields no text', async () => {
    ocrExtractFromFile.mockResolvedValue(null);
    const result = await extractCoaFromFile(new Blob(['x']), 'coa.pdf');
    expect(result.aiUnavailable).toBe(true);
    expect(result.extraction).toBeNull();
    expect(llmCompleteJson).not.toHaveBeenCalled();
  });

  it('returns aiUnavailable when LLM extraction fails', async () => {
    ocrExtractFromFile.mockResolvedValue({ text: 'some text', pages: [{}] });
    llmCompleteJson.mockResolvedValue(null);
    const result = await extractCoaFromFile(new Blob(['x']), 'coa.pdf');
    expect(result.aiUnavailable).toBe(true);
    expect(result.rawText).toBe('some text');
  });
});

describe('extractCoaFromText - normalization', () => {
  it('coerces missing/odd fields safely', async () => {
    llmCompleteJson.mockResolvedValue({
      productName: '  Spaced Name  ',
      lotNumber: null,
      testResults: [
        { parameter: 'pH', result: '5.5', specification: null, pass: 'yes' /* wrong type */ },
        { parameter: '', result: 'x' /* dropped: no parameter */ },
        'garbage', // dropped: not an object
      ],
      overallResult: 'maybe', // invalid -> unknown
    });

    const result = await extractCoaFromText('text');
    const ex = result.extraction!;
    expect(ex.productName).toBe('Spaced Name'); // trimmed
    expect(ex.lotNumber).toBeNull();
    expect(ex.testResults).toHaveLength(1); // garbage + empty-param dropped
    expect(ex.testResults[0].pass).toBeNull(); // 'yes' not boolean -> null
    expect(ex.overallResult).toBe('unknown');
  });

  it('returns aiUnavailable for empty text without calling LLM', async () => {
    const result = await extractCoaFromText('   ');
    expect(result.aiUnavailable).toBe(true);
    expect(llmCompleteJson).not.toHaveBeenCalled();
  });
});
