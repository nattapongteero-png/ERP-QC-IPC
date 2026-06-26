/**
 * SOP / GMP Assistant — shared types
 *
 * Kept separate from sop-assistant.service.ts so the chat page / tests can
 * import these types without pulling the service's runtime AI-client + document
 * service dependencies.
 */

export interface SopCitation {
  documentId: number;
  documentNumber: string;
  title: string;
  versionNumber: string;
}

export interface SopAnswer {
  answer: string;
  citations: SopCitation[];
  /** True when the LLM was unavailable; caller should fall back / retry. */
  aiUnavailable: boolean;
  /** True when no relevant active documents were found for the question. */
  noSources: boolean;
}

export interface SopAskOptions {
  /** Max documents to pull into context (default 5). */
  maxDocs?: number;
  /** Restrict to a document type (e.g. SOP type id). */
  typeId?: number;
  /** Per-document content cap (chars) to keep the prompt bounded. */
  maxCharsPerDoc?: number;
}
