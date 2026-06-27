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

// Types live in src/types/sop-assistant.ts so UI/tests can import them without
// the service's runtime deps. Re-exported here for backward compatibility.
export type { SopCitation, SopAnswer, SopAskOptions } from '@/types/sop-assistant';
import type { SopCitation, SopAnswer, SopAskOptions } from '@/types/sop-assistant';

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

/**
 * Strip the common Thai interrogative/particle tails that get glued onto a noun
 * phrase because Thai is written without spaces — e.g.
 * "การทำความสะอาดทำยังไง" → "การทำความสะอาด". Without this, the whole run is one
 * token that never matches a document titled "การทำความสะอาด (Cleaning)".
 */
const THAI_TAILS = ['ทำยังไง', 'ทำอย่างไร', 'ยังไง', 'อย่างไร', 'ทำไง', 'คืออะไร', 'อะไร', 'ไหม', 'หรือไม่', 'ทำ'];
function stripThaiTails(token: string): string {
  let t = token;
  let changed = true;
  while (changed) {
    changed = false;
    for (const tail of THAI_TAILS) {
      if (t.length > tail.length && t.endsWith(tail)) {
        t = t.slice(0, -tail.length);
        changed = true;
      }
    }
  }
  return t;
}

function keywords(question: string): string[] {
  const out = new Set<string>();
  const raw = question
    .toLowerCase()
    .split(/[\s,.?!()/\\"'：:；;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

  for (const w of raw) {
    out.add(w);
    // For glued Thai phrases, also add the phrase with trailing question
    // particles removed, so it matches a document's noun-phrase title/body.
    const stripped = stripThaiTails(w);
    if (stripped.length >= 2 && stripped !== w && !STOPWORDS.has(stripped)) {
      out.add(stripped);
    }
  }
  return [...out];
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

  // TEMP DEBUG (remove after diagnosing SOP-assistant no-match): log how the
  // question was tokenised and how many docs each search term matched.
  console.log('[SOP-DEBUG] question=', JSON.stringify(question), 'terms=', JSON.stringify(terms), 'queries=', JSON.stringify(queries));

  for (const q of queries) {
    const res = await getDocuments({ status: 'active', typeId: options.typeId, search: q, limit: 20 });
    console.log('[SOP-DEBUG] search=', JSON.stringify(q), '→ matched', res.documents.length, 'docs:', JSON.stringify(res.documents.slice(0, 3).map((d) => d.title)));
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
    console.log('[SOP-DEBUG] hydrate id=', id, 'title=', JSON.stringify(detail?.title), 'hasContent=', !!(content && content.trim()), 'contentLen=', content ? content.length : 0);
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
