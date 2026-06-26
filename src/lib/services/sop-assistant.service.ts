/**
 * SOP / GMP Assistant (RAG) Service
 *
 * Answers operator questions by retrieving the relevant ACTIVE controlled
 * documents (SOPs, GMP procedures) from the document module, feeding their
 * content to the LLM brain (vllm-gemma) as context, and returning a grounded
 * answer with citations.
 *
 * Retrieval is keyword-based (no embedding store): for a controlled-document
 * corpus this is adequate, and Gemma-4's 262k context comfortably holds the
 * top matching documents. The model is instructed to answer ONLY from the
 * provided documents and to cite the document number + version it used — so the
 * answer is auditable and never fabricated.
 *
 * Degrades gracefully: returns aiUnavailable when the LLM is down; returns an
 * empty-sources answer when nothing relevant is found (no hallucination).
 */

import { complete } from './ai';
import { getDocuments, getDocumentById } from './document-service';

// ============================================
// Types
// ============================================

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

// ============================================
// Retrieval
// ============================================

interface RetrievedDoc extends SopCitation {
  content: string;
}

/** Pull stopwords out so the keyword search isn't dominated by particles. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are',
  'how', 'what', 'when', 'where', 'do', 'i', 'we', 'การ', 'ของ', 'และ', 'ที่',
  'ใน', 'เป็น', 'มี', 'ทำ', 'อย่างไร', 'ยังไง', 'คือ',
]);

function keywords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[\s,.?!()/\\"'：:；;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Retrieve the most relevant ACTIVE documents for a question.
 * Strategy: query the active-document list per keyword (the document service's
 * `search` filters title), merge by document id, rank by how many distinct
 * keywords matched, then hydrate the top N with their version content.
 */
async function retrieveDocs(
  question: string,
  options: SopAskOptions
): Promise<RetrievedDoc[]> {
  const maxDocs = options.maxDocs ?? 5;
  const maxChars = options.maxCharsPerDoc ?? 8000;
  const terms = keywords(question);

  // Score documents by distinct-keyword hits across per-term searches.
  const hitCount = new Map<number, number>();
  const seen = new Map<number, { documentNumber: string; title: string; currentVersionNumber?: string }>();

  // Always include a broad pass on the full question too (catches multi-word titles).
  const queries = terms.length > 0 ? [question, ...terms] : [question];

  for (const q of queries) {
    const res = await getDocuments({ status: 'active', typeId: options.typeId, search: q, limit: 20 });
    for (const doc of res.documents) {
      hitCount.set(doc.id, (hitCount.get(doc.id) ?? 0) + 1);
      if (!seen.has(doc.id)) {
        seen.set(doc.id, {
          documentNumber: doc.documentNumber,
          title: doc.title,
          currentVersionNumber: doc.currentVersionNumber,
        });
      }
    }
  }

  const ranked = [...hitCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxDocs)
    .map(([id]) => id);

  // Hydrate content for the top-ranked documents.
  const docs: RetrievedDoc[] = [];
  for (const id of ranked) {
    const detail = await getDocumentById(id);
    const content = detail?.currentVersion?.content;
    if (!content || !content.trim()) continue; // skip file-only docs with no text
    const meta = seen.get(id)!;
    docs.push({
      documentId: id,
      documentNumber: detail.documentNumber ?? meta.documentNumber,
      title: detail.title ?? meta.title,
      versionNumber: detail.currentVersion?.versionNumber ?? meta.currentVersionNumber ?? '-',
      content: content.length > maxChars ? content.slice(0, maxChars) + '\n…[truncated]' : content,
    });
  }
  return docs;
}

// ============================================
// Prompt
// ============================================

const SYSTEM_PROMPT =
  'You are a GMP/SOP assistant for an herbal-medicine manufacturer. Answer the ' +
  "user's question using ONLY the controlled documents provided below. If the " +
  'answer is not contained in them, say you could not find it in the current ' +
  'controlled documents — never invent procedures. Cite the document number(s) ' +
  'and version you used inline, e.g. (SOP-QA-001 v2). Answer in the same ' +
  'language as the question (Thai or English). Be concise and operational.';

function buildPrompt(question: string, docs: RetrievedDoc[]): string {
  const context = docs
    .map(
      (d, i) =>
        `### Document ${i + 1}: ${d.documentNumber} v${d.versionNumber} — ${d.title}\n${d.content}`
    )
    .join('\n\n---\n\n');

  return `Controlled documents:\n\n${context}\n\n========\n\nQuestion: ${question}`;
}

// ============================================
// Public API
// ============================================

/**
 * Ask the SOP/GMP assistant a question. Retrieves relevant active documents,
 * grounds the LLM answer in them, and returns the answer + citations.
 */
export async function askSop(question: string, options: SopAskOptions = {}): Promise<SopAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { answer: '', citations: [], aiUnavailable: false, noSources: true };
  }

  const docs = await retrieveDocs(trimmed, options);

  if (docs.length === 0) {
    return {
      answer: 'ไม่พบเอกสารควบคุม (SOP/GMP) ที่เกี่ยวข้องกับคำถามนี้ในระบบ',
      citations: [],
      aiUnavailable: false,
      noSources: true,
    };
  }

  const answer = await complete(buildPrompt(trimmed, docs), SYSTEM_PROMPT, { temperature: 0.1 });

  if (answer === null) {
    return {
      answer: '',
      citations: docs.map(toCitation),
      aiUnavailable: true,
      noSources: false,
    };
  }

  return {
    answer,
    citations: docs.map(toCitation),
    aiUnavailable: false,
    noSources: false,
  };
}

function toCitation(d: RetrievedDoc): SopCitation {
  return {
    documentId: d.documentId,
    documentNumber: d.documentNumber,
    title: d.title,
    versionNumber: d.versionNumber,
  };
}
