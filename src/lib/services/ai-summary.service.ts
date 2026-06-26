/**
 * AI Summary Service
 *
 * Generic "summarize this record with AI" helper built on the LLM brain
 * (vllm-gemma). Turns a structured record (CAPA, batch record, deviation,
 * complaint…) into a concise, human-readable narrative — useful for management
 * review, sign-off cover notes, and quick context.
 *
 * Domain-agnostic: the caller passes a domain label, the fields to summarize,
 * and an optional focus. Reusable across modules (DRY) rather than a per-module
 * summarizer. Degrades gracefully: returns null when the LLM is unavailable.
 */

import { complete } from './ai';

export type SummaryDomain = 'capa' | 'deviation' | 'complaint' | 'batch_record' | 'generic';

export interface SummaryRequest {
  domain: SummaryDomain;
  /** Title/heading of the thing being summarized (e.g. CAPA number + title). */
  heading: string;
  /** Flat key→value pairs of the record's relevant fields. */
  fields: Record<string, unknown>;
  /** Optional list items (e.g. CAPA actions, test results). */
  items?: Array<{ label: string; detail?: string }>;
  /** What to emphasize, e.g. "risk and regulatory impact". */
  focus?: string;
  /** Output language; defaults to Thai. */
  language?: 'th' | 'en';
}

const DOMAIN_HINTS: Record<SummaryDomain, string> = {
  capa: 'a CAPA (Corrective And Preventive Action) record in a GMP pharmaceutical quality system',
  deviation: 'a GMP deviation / non-conformance record',
  complaint: 'a product quality complaint record',
  batch_record: 'a manufacturing batch record',
  generic: 'a quality-management record',
};

function buildSystemPrompt(domain: SummaryDomain, language: 'th' | 'en'): string {
  const lang = language === 'en' ? 'English' : 'Thai';
  return (
    `You are a pharmaceutical QA analyst. Summarize ${DOMAIN_HINTS[domain]} for a ` +
    `manager who has 30 seconds. Be factual and grounded ONLY in the data given — ` +
    `do not invent values or recommendations not supported by the data. Write in ${lang}. ` +
    `Use a short paragraph followed by 2-4 bullet points of the most important facts ` +
    `(status, risk, key actions, outstanding items). Keep it under ~150 words.`
  );
}

function buildUserPrompt(req: SummaryRequest): string {
  const fieldLines = Object.entries(req.fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `- ${k}: ${formatValue(v)}`)
    .join('\n');

  const itemLines =
    req.items && req.items.length > 0
      ? '\n\nItems:\n' +
        req.items.map((it) => `- ${it.label}${it.detail ? `: ${it.detail}` : ''}`).join('\n')
      : '';

  const focusLine = req.focus ? `\n\nEmphasize: ${req.focus}` : '';

  return `${req.heading}\n\nFields:\n${fieldLines}${itemLines}${focusLine}`;
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

/**
 * Generate an AI summary for a record.
 *
 * @returns the summary text, or null if the LLM is unavailable / on error.
 */
export async function summarizeRecord(req: SummaryRequest): Promise<string | null> {
  const language = req.language ?? 'th';
  if (!req.heading?.trim() && Object.keys(req.fields ?? {}).length === 0) {
    return null;
  }
  return complete(buildUserPrompt(req), buildSystemPrompt(req.domain, language), {
    temperature: 0.2,
    maxTokens: 400,
  });
}
