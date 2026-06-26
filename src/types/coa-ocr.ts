/**
 * Supplier CoA OCR — shared types
 *
 * Kept separate from coa-ocr.service.ts so UI components / tests can import these
 * types WITHOUT pulling in the service's runtime dependency on the AI clients
 * (which load DevExtreme-adjacent / network modules and slow jsdom test startup).
 */
import type { OcrBackend } from '@/lib/services/ai/types';

export interface CoaTestResult {
  /** Parameter / test name, e.g. "Loss on Drying" */
  parameter: string;
  /** Reported result as written on the CoA, e.g. "8.2 %" */
  result: string;
  /** Spec / acceptance criteria if printed on the CoA, e.g. "NMT 10 %" */
  specification: string | null;
  /** Pass/Fail judgement when determinable; null if the CoA doesn't state it */
  pass: boolean | null;
}

export interface CoaExtraction {
  productName: string | null;
  /** Supplier's own item / material code if shown */
  supplierItemCode: string | null;
  lotNumber: string | null;
  batchNumber: string | null;
  /** ISO date string (YYYY-MM-DD) when parseable, else the raw text */
  manufactureDate: string | null;
  expiryDate: string | null;
  manufacturerName: string | null;
  quantity: string | null;
  testResults: CoaTestResult[];
  /** Overall CoA disposition if the document states one */
  overallResult: 'pass' | 'fail' | 'unknown';
  /** Free-text notes the model found relevant (warnings, conditions, etc.) */
  notes: string | null;
}

export interface CoaOcrResult {
  extraction: CoaExtraction | null;
  /** Raw OCR text, kept for audit / manual review */
  rawText: string | null;
  /** Number of pages OCR'd */
  pageCount: number;
  /** True when OCR or LLM was unavailable (caller should fall back to manual) */
  aiUnavailable: boolean;
  /** Human-readable reason when something went wrong */
  message?: string;
}

export interface CoaOcrOptions {
  /** OCR engine: typhoon (printed, default) or chandra (handwriting) */
  backend?: OcrBackend;
  /** Enable Gemma-4 visual analysis for complex layouts */
  analyzePages?: boolean;
}
