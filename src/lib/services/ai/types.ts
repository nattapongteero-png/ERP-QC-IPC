/**
 * BMS AI Ecosystem - Shared Types
 *
 * Types shared across the four AI clients. Keep provider-specific request/response
 * shapes minimal: we only model the fields the ERP actually uses.
 */

// ============================================
// LLM (vllm-gemma)
// ============================================

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  /** Override the default model alias */
  model?: string;
  /** 0-2; lower = more deterministic */
  temperature?: number;
  maxTokens?: number;
  /** Force a JSON-object response (OpenAI-compatible) */
  jsonMode?: boolean;
  /** Abort if no response within this many ms */
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================
// OCR (pdf-ocr-mcp)
// ============================================

export type OcrBackend = 'typhoon' | 'chandra';
export type OcrFormat = 'text' | 'markdown';
export type OcrFallback = 'auto' | 'never' | 'always';

export interface OcrOptions {
  /** Output format; markdown preserves layout */
  fmt?: OcrFormat;
  /** When to invoke OCR vs. embedded-text extraction */
  ocrFallback?: OcrFallback;
  /** OCR engine: typhoon = printed Thai, chandra = handwriting */
  backend?: OcrBackend;
  /** Restrict to specific zero-based page indices */
  pages?: number[];
  /** Enable Gemma-4 visual page analysis */
  analyzePages?: boolean;
  /** Override the OCR system prompt */
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface OcrPage {
  pageIndex: number;
  source: string;
  chars: number;
  finishReason: string;
}

export interface OcrResult {
  text: string;
  chars: number;
  fmt: string;
  pages: OcrPage[];
  ocrPageCount: number;
  anyTruncated: boolean;
}

// ============================================
// ASR (asr2)
// ============================================

export interface TranscriptionOptions {
  /** ISO language hint, e.g. "th". Omit for auto-detect. */
  language?: string;
  /** Bias the transcription with context terms */
  prompt?: string;
  model?: string;
  timeoutMs?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
}

// ============================================
// TTS (vox-cpm)
// ============================================

export type TtsFormat = 'wav' | 'mp3';

export interface SpeechOptions {
  /** Voice preset: default | female | male | female_sofia | male_eugene */
  voice?: string;
  format?: TtsFormat;
  model?: string;
  timeoutMs?: number;
}

export interface SpeechResult {
  /** Raw audio bytes */
  audio: ArrayBuffer;
  contentType: string;
}
