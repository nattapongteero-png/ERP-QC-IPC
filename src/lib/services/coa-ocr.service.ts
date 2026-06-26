/**
 * Supplier CoA OCR Extraction Service
 *
 * Reads an INCOMING supplier Certificate of Analysis (PDF/image) at Goods
 * Receipt, OCRs it (pdf-ocr-mcp), then uses the LLM brain (vllm-gemma) to pull
 * structured fields the GRN form can auto-fill — and flags test results that
 * fall outside the provided spec.
 *
 * NOTE: This is the *incoming* supplier CoA flow — distinct from coa.service.ts,
 * which ISSUES our own outgoing CoA to customers.
 *
 * Degrades gracefully: if OCR or the LLM is unavailable, returns a result with
 * aiUnavailable: true and empty fields so the operator can still fill manually.
 */

import { ocr, llm } from './ai';

// ============================================
// Types
// ============================================

// Types live in src/types/coa-ocr.ts so UI/tests can import them without
// pulling this service's runtime AI-client dependencies. Re-exported here for
// backward compatibility with existing imports.
export type {
  CoaTestResult,
  CoaExtraction,
  CoaOcrResult,
  CoaOcrOptions,
} from '@/types/coa-ocr';
import type { CoaTestResult, CoaExtraction, CoaOcrResult, CoaOcrOptions } from '@/types/coa-ocr';

// ============================================
// Prompt
// ============================================

const SYSTEM_PROMPT =
  'You are a pharmaceutical QA assistant specialized in reading supplier ' +
  "Certificates of Analysis (CoA) for raw materials. Extract data faithfully — " +
  'never invent values. If a field is absent, return null. Dates must be ' +
  'normalized to YYYY-MM-DD when unambiguous, otherwise keep the original text. ' +
  'Respond ONLY with the requested JSON object.';

function buildExtractionPrompt(ocrText: string): string {
  return `Extract the following from this Certificate of Analysis and return JSON
matching exactly this shape:

{
  "productName": string | null,
  "supplierItemCode": string | null,
  "lotNumber": string | null,
  "batchNumber": string | null,
  "manufactureDate": string | null,
  "expiryDate": string | null,
  "manufacturerName": string | null,
  "quantity": string | null,
  "testResults": [
    { "parameter": string, "result": string, "specification": string | null, "pass": boolean | null }
  ],
  "overallResult": "pass" | "fail" | "unknown",
  "notes": string | null
}

Rules:
- For each test row, set "pass" to true/false only if you can judge the result
  against the printed specification; otherwise null.
- "overallResult" = "pass" only if the CoA explicitly states overall conformance
  or every judgeable test passes; "fail" if any fails; otherwise "unknown".
- Do not include any text outside the JSON object.

Certificate of Analysis text:
"""
${ocrText}
"""`;
}

// ============================================
// Public API
// ============================================

function unavailable(message: string, rawText: string | null = null, pageCount = 0): CoaOcrResult {
  return { extraction: null, rawText, pageCount, aiUnavailable: true, message };
}

/**
 * Run the full CoA pipeline on an uploaded file (PDF or image).
 *
 * @param file     The uploaded CoA bytes.
 * @param filename Original filename (used by OCR to sniff the type).
 */
export async function extractCoaFromFile(
  file: Blob,
  filename: string,
  options: CoaOcrOptions = {}
): Promise<CoaOcrResult> {
  // 1. OCR the document to plain text (markdown preserves table layout).
  const ocrResult = await ocr.extractFromFile(file, filename, {
    fmt: 'markdown',
    ocrFallback: 'auto',
    backend: options.backend ?? 'typhoon',
    analyzePages: options.analyzePages ?? false,
  });

  if (!ocrResult || !ocrResult.text.trim()) {
    return unavailable('OCR service unavailable or returned no text');
  }

  // 2. Ask the LLM to pull structured fields from the OCR text.
  return extractCoaFromText(ocrResult.text, ocrResult.pages.length);
}

/**
 * Run only the structured-extraction step on already-OCR'd text. Useful when the
 * caller has the raw text (e.g. re-running extraction with a tweaked prompt) or
 * for testing without the OCR round-trip.
 */
export async function extractCoaFromText(
  ocrText: string,
  pageCount = 1
): Promise<CoaOcrResult> {
  if (!ocrText.trim()) {
    return unavailable('Empty OCR text', ocrText, pageCount);
  }

  const parsed = await llm.completeJson<CoaExtraction>(
    buildExtractionPrompt(ocrText),
    SYSTEM_PROMPT,
    { temperature: 0 }
  );

  if (!parsed) {
    return unavailable('LLM extraction unavailable', ocrText, pageCount);
  }

  return {
    extraction: normalizeExtraction(parsed),
    rawText: ocrText,
    pageCount,
    aiUnavailable: false,
  };
}

/** Defensive normalization — the model may omit fields or wrong-type them. */
function normalizeExtraction(input: unknown): CoaExtraction {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const rawTests = Array.isArray(raw.testResults) ? raw.testResults : [];
  const testResults: CoaTestResult[] = rawTests
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map((t) => ({
      parameter: String(t.parameter ?? ''),
      result: String(t.result ?? ''),
      specification: t.specification != null ? String(t.specification) : null,
      pass: typeof t.pass === 'boolean' ? t.pass : null,
    }))
    .filter((t) => t.parameter);

  const overall = raw.overallResult;
  return {
    productName: strOrNull(raw.productName),
    supplierItemCode: strOrNull(raw.supplierItemCode),
    lotNumber: strOrNull(raw.lotNumber),
    batchNumber: strOrNull(raw.batchNumber),
    manufactureDate: strOrNull(raw.manufactureDate),
    expiryDate: strOrNull(raw.expiryDate),
    manufacturerName: strOrNull(raw.manufacturerName),
    quantity: strOrNull(raw.quantity),
    testResults,
    overallResult: overall === 'pass' || overall === 'fail' ? overall : 'unknown',
    notes: strOrNull(raw.notes),
  };
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
