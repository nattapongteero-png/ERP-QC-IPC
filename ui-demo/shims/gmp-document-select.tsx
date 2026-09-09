import * as React from 'react';
import { SearchableSelect } from '@/components/master-data/SearchableSelect';

/**
 * Demo stand-in for GmpDocumentSelect.
 *
 * The real one is a DevExtreme SelectBox. DevExtreme is licensed per developer
 * and its bundle prints "Redistribution prohibited" — shipping it inside a
 * public static site would be redistributing it. This keeps the same props and
 * the same choice of documents, drawn with the project's own select.
 */
const DOCS = [
  { id: 1, documentNumber: 'SOP-QC-001', title: 'วิธีทดสอบความแข็งของเม็ดยา', status: 'ใช้งาน' },
  { id: 2, documentNumber: 'SOP-QC-002', title: 'วิธีทดสอบความกร่อน (Friability)', status: 'ใช้งาน' },
  { id: 3, documentNumber: 'SOP-QC-014', title: 'การสุ่มตัวอย่างระหว่างการผลิต', status: 'ใช้งาน' },
  { id: 4, documentNumber: 'SOP-QC-021', title: 'การทดสอบการกระจายตัวของยาเม็ด', status: 'ร่าง' },
  { id: 5, documentNumber: 'WI-QC-007', title: 'วิธีใช้เครื่องชั่งวิเคราะห์', status: 'ใช้งาน' },
].map((d) => ({
  ...d,
  currentVersionId: null,
  label: `${d.documentNumber} — ${d.title} (${d.status})`,
}));

export function GmpDocumentSelect({
  value,
  onValueChange,
  onDocumentChange,
  placeholder = 'เลือกเอกสาร GMP (ไม่บังคับ)…',
}: {
  value: number | null;
  onValueChange: (id: number | null) => void;
  onDocumentChange?: (doc: (typeof DOCS)[number] | null) => void;
  disabled?: boolean;
  placeholder?: string;
  width?: number | string;
  height?: number | string;
}) {
  return (
    <SearchableSelect
      value={value == null ? '' : String(value)}
      onChange={(v) => {
        const id = v ? Number(v) : null;
        onValueChange(id);
        onDocumentChange?.(id == null ? null : (DOCS.find((d) => d.id === id) ?? null));
      }}
      options={DOCS.map((d) => ({ value: String(d.id), label: d.label }))}
      placeholder={placeholder}
      testId="gmp-document"
    />
  );
}

export default GmpDocumentSelect;

/**
 * Demo stand-in for GmpDocumentPreviewDialog.
 *
 * The real dialog is a DevExtreme popup around a PDF viewer, and neither
 * travels: DevExtreme may not be redistributed, and the sample SOPs have no
 * attachment to view. This keeps the same props and shows the document's
 * written procedure — which is what the step is actually asking the operator
 * to read — in the same soft dialog the rest of the screens use.
 */
export function GmpDocumentPreviewDialog({
  documentId,
  visible,
  onClose,
}: {
  documentId: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [doc, setDoc] = React.useState<{
    documentNumber?: string;
    title?: string;
    content?: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!visible || documentId == null) return;
    setDoc(null);
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((j) => setDoc(j?.data?.document ?? j?.data ?? j))
      .catch(() => setDoc(null));
  }, [visible, documentId]);

  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]">
        <div className="flex shrink-0 items-start gap-3 border-b border-[#f1f3f5] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-black">
              {doc?.title ?? 'เอกสาร GMP'}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#bfbfbf]">
              {doc?.documentNumber ?? 'กำลังเปิดเอกสาร…'}
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-[#f1f3f5] hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] px-6 py-5">
          <div className="rounded-[16px] bg-white p-5">
            {doc?.content ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
                {doc.content}
              </pre>
            ) : (
              <p className="text-center text-[13px] text-slate-500">
                {doc ? 'เอกสารนี้ยังไม่มีเนื้อหาให้แสดง' : 'กำลังโหลด…'}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 justify-end border-t border-[#f1f3f5] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e1e4e8] bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:border-[#9db9e8] hover:text-[#2f6fd0]"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
