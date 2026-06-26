/**
 * Tests for the SOP/GMP RAG assistant service (node env — fast, no jsdom).
 * Mocks the AI client and document service.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const complete = vi.fn();
const getDocuments = vi.fn();
const getDocumentById = vi.fn();

vi.mock('@/lib/services/ai', () => ({
  complete: (...a: unknown[]) => complete(...a),
}));
vi.mock('@/lib/services/document-service', () => ({
  getDocuments: (...a: unknown[]) => getDocuments(...a),
  getDocumentById: (...a: unknown[]) => getDocumentById(...a),
}));

import { askSop } from '@/lib/services/sop-assistant.service';

function doc(id: number, number: string, title: string) {
  return { id, documentNumber: number, title, currentVersionNumber: 'v2' };
}
function detail(id: number, number: string, title: string, content: string) {
  return {
    id,
    documentNumber: number,
    title,
    currentVersion: { versionNumber: 'v2', content },
  };
}

beforeEach(() => {
  complete.mockReset();
  getDocuments.mockReset();
  getDocumentById.mockReset();
});

describe('askSop', () => {
  it('retrieves active docs, grounds the answer, and returns citations', async () => {
    getDocuments.mockResolvedValue({ documents: [doc(1, 'SOP-QA-001', 'Recall Procedure')], total: 1 });
    getDocumentById.mockResolvedValue(
      detail(1, 'SOP-QA-001', 'Recall Procedure', 'Step 1: notify QA. Step 2: quarantine stock.')
    );
    complete.mockResolvedValue('ขั้นตอน recall: 1) แจ้ง QA 2) กักสินค้า (SOP-QA-001 v2)');

    const result = await askSop('ขั้นตอน recall ทำอย่างไร');

    // active-only retrieval
    expect(getDocuments).toHaveBeenCalled();
    expect(getDocuments.mock.calls[0][0]).toMatchObject({ status: 'active' });

    // grounded prompt includes the document content
    const prompt = complete.mock.calls[0][0] as string;
    expect(prompt).toContain('SOP-QA-001');
    expect(prompt).toContain('quarantine stock');

    expect(result.aiUnavailable).toBe(false);
    expect(result.noSources).toBe(false);
    expect(result.answer).toContain('SOP-QA-001');
    expect(result.citations).toEqual([
      { documentId: 1, documentNumber: 'SOP-QA-001', title: 'Recall Procedure', versionNumber: 'v2' },
    ]);
  });

  it('returns noSources (no LLM call) when nothing relevant is found', async () => {
    getDocuments.mockResolvedValue({ documents: [], total: 0 });

    const result = await askSop('something with no matching SOP');

    expect(result.noSources).toBe(true);
    expect(result.citations).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });

  it('skips file-only docs that have no text content', async () => {
    getDocuments.mockResolvedValue({ documents: [doc(1, 'SOP-X', 'Scanned only')], total: 1 });
    getDocumentById.mockResolvedValue(detail(1, 'SOP-X', 'Scanned only', '')); // empty content
    const result = await askSop('test question');

    expect(result.noSources).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  });

  it('reports aiUnavailable but still returns citations when the LLM is down', async () => {
    getDocuments.mockResolvedValue({ documents: [doc(1, 'SOP-QA-001', 'Recall')], total: 1 });
    getDocumentById.mockResolvedValue(detail(1, 'SOP-QA-001', 'Recall', 'content here'));
    complete.mockResolvedValue(null);

    const result = await askSop('recall?');
    expect(result.aiUnavailable).toBe(true);
    expect(result.citations).toHaveLength(1);
  });

  it('ranks docs by distinct-keyword hits and caps to maxDocs', async () => {
    // doc 2 matches more keyword queries -> should rank first
    getDocuments.mockImplementation(async ({ search }: { search: string }) => {
      if (search.includes('cleaning')) return { documents: [doc(2, 'SOP-2', 'Cleaning')], total: 1 };
      if (search.includes('validation')) return { documents: [doc(2, 'SOP-2', 'Cleaning'), doc(3, 'SOP-3', 'Validation')], total: 2 };
      return { documents: [doc(2, 'SOP-2', 'Cleaning')], total: 1 };
    });
    getDocumentById.mockImplementation(async (id: number) =>
      detail(id, `SOP-${id}`, `Title ${id}`, `body ${id}`)
    );
    complete.mockResolvedValue('answer');

    const result = await askSop('cleaning validation', { maxDocs: 1 });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].documentId).toBe(2); // highest hit count
  });

  it('returns noSources for an empty question without hitting services', async () => {
    const result = await askSop('   ');
    expect(result.noSources).toBe(true);
    expect(getDocuments).not.toHaveBeenCalled();
  });
});
