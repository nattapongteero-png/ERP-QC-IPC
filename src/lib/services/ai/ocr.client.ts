/**
 * OCR Client - pdf-ocr-mcp (Typhoon / Chandra / Gemma-4)
 *
 * The "Eye". Extracts text from PDFs and images. Primary ERP use: ingest
 * supplier CoA / invoices at Goods Receipt and feed the text to the LLM for
 * structured field extraction + spec comparison.
 *
 *   - typhoon : printed Thai text (default)
 *   - chandra : handwriting
 *   - analyzePages -> Gemma-4 visual analysis
 *
 * Endpoints (base path = /api):
 *   POST /api/pdf_extract         (JSON: pdf_base64 | pdf_path)
 *   POST /api/pdf_extract/upload  (multipart: file)
 */

import { AI_CONFIG, isConfigured } from './config';
import { logAiError } from './llm.client';
import type { OcrOptions, OcrResult } from './types';

/** Map our camelCase options to the service's snake_case request fields. */
function buildOcrBody(options: OcrOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (options.fmt) body.fmt = options.fmt;
  if (options.ocrFallback) body.ocr_fallback = options.ocrFallback;
  if (options.backend) body.backend = options.backend;
  if (options.pages) body.pages = options.pages;
  if (options.analyzePages !== undefined) body.analyze_pages = options.analyzePages;
  if (options.systemPrompt) body.system_prompt = options.systemPrompt;
  return body;
}

/** Normalize the service response into our OcrResult shape. */
function parseOcrResponse(data: unknown): OcrResult | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.text !== 'string') {
    console.error('[ai/ocr] Invalid response (no text field)');
    return null;
  }
  const rawPages = Array.isArray(d.pages) ? d.pages : [];
  return {
    text: d.text,
    chars: typeof d.chars === 'number' ? d.chars : d.text.length,
    fmt: typeof d.fmt === 'string' ? d.fmt : 'text',
    pages: rawPages.map((p) => {
      const pg = p as Record<string, unknown>;
      return {
        pageIndex: Number(pg.page_index ?? 0),
        source: String(pg.source ?? ''),
        chars: Number(pg.chars ?? 0),
        finishReason: String(pg.finish_reason ?? ''),
      };
    }),
    ocrPageCount: Number(d.ocr_page_count ?? 0),
    anyTruncated: Boolean(d.any_truncated),
  };
}

/**
 * Extract text from a base64-encoded PDF.
 *
 * @param pdfBase64 Base64 string of the PDF bytes (no data: prefix).
 * @returns OcrResult on success, or null on failure / unconfigured.
 */
export async function extractFromBase64(
  pdfBase64: string,
  options: OcrOptions = {}
): Promise<OcrResult | null> {
  if (!isConfigured('ocr')) {
    console.warn('[ai/ocr] AI_OCR_BASE_URL not configured');
    return null;
  }

  const { baseUrl, apiKey, timeout } = AI_CONFIG.ocr;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${baseUrl}/api/pdf_extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pdf_base64: pdfBase64, ...buildOcrBody(options) }),
      signal: AbortSignal.timeout(options.timeoutMs || timeout),
    });

    if (!response.ok) {
      console.error(`[ai/ocr] HTTP ${response.status} ${response.statusText}`);
      return null;
    }
    return parseOcrResponse(await response.json());
  } catch (error) {
    logAiError('ocr', error);
    return null;
  }
}

/**
 * Extract text by uploading a file (PDF or image) via multipart/form-data.
 * Accepts a Blob/File so it works from both the server and edge contexts.
 *
 * @returns OcrResult on success, or null on failure / unconfigured.
 */
export async function extractFromFile(
  file: Blob,
  filename: string,
  options: OcrOptions = {}
): Promise<OcrResult | null> {
  if (!isConfigured('ocr')) {
    console.warn('[ai/ocr] AI_OCR_BASE_URL not configured');
    return null;
  }

  const { baseUrl, apiKey, timeout } = AI_CONFIG.ocr;

  const form = new FormData();
  form.append('file', file, filename);
  if (options.fmt) form.append('fmt', options.fmt);
  if (options.ocrFallback) form.append('ocr_fallback', options.ocrFallback);
  if (options.backend) form.append('backend', options.backend);
  if (options.pages) form.append('pages', options.pages.join(','));
  if (options.analyzePages !== undefined) form.append('analyze_pages', String(options.analyzePages));
  if (options.systemPrompt) form.append('system_prompt', options.systemPrompt);

  // NOTE: do NOT set Content-Type; the runtime sets the multipart boundary.
  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${baseUrl}/api/pdf_extract/upload`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(options.timeoutMs || timeout),
    });

    if (!response.ok) {
      console.error(`[ai/ocr] HTTP ${response.status} ${response.statusText}`);
      return null;
    }
    return parseOcrResponse(await response.json());
  } catch (error) {
    logAiError('ocr', error);
    return null;
  }
}
