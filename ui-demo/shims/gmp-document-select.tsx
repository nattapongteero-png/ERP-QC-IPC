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
