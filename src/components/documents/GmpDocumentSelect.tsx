'use client';

/**
 * GmpDocumentSelect — searchable dropdown of controlled GMP documents.
 *
 * Used to link a GMP document (e.g. a test-method SOP) to an IPC criterion
 * or an SOP procedure step. Stores the document id; shows "DOC-NO — Title".
 */
import { useEffect, useState } from 'react';
import { SelectBox } from 'devextreme-react/select-box';

export interface GmpDocumentOption {
  id: number;
  documentNumber: string;
  title: string;
  status: string;
  label: string;
  currentVersionId: number | null;
}

interface GmpDocumentSelectProps {
  value: number | null;
  onValueChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  width?: number | string;
}

const STATUS_TH: Record<string, string> = {
  draft: 'ร่าง',
  active: 'ใช้งาน',
  obsolete: 'ยกเลิก',
  archived: 'จัดเก็บ',
};

// Module-level cache so the list is fetched once and shared across rows.
let _cache: GmpDocumentOption[] | null = null;
let _inflight: Promise<GmpDocumentOption[]> | null = null;

async function loadDocuments(): Promise<GmpDocumentOption[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    // No status filter — controlled docs are often still "draft" during setup,
    // so show all and tag the status so the user can pick the right one.
    const res = await fetch(`/api/documents?limit=1000`);
    if (!res.ok) return [];
    const body = await res.json();
    const docs = body?.data?.documents ?? body?.documents ?? [];
    _cache = docs.map((d: any) => {
      const status = String(d.status ?? '');
      const statusTh = STATUS_TH[status] ?? status;
      return {
        id: Number(d.id),
        documentNumber: String(d.documentNumber ?? ''),
        title: String(d.title ?? ''),
        status,
        label: `${d.documentNumber} — ${d.title}${statusTh ? ` (${statusTh})` : ''}`,
        currentVersionId: d.currentVersionId != null ? Number(d.currentVersionId) : null,
      };
    });
    return _cache!;
  })();
  return _inflight;
}

export function GmpDocumentSelect({
  value,
  onValueChange,
  disabled,
  placeholder = 'เลือกเอกสาร GMP (ไม่บังคับ)…',
  width = '100%',
}: GmpDocumentSelectProps) {
  const [options, setOptions] = useState<GmpDocumentOption[]>(_cache ?? []);

  useEffect(() => {
    let alive = true;
    loadDocuments().then((opts) => {
      if (alive) setOptions(opts);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SelectBox
      dataSource={options}
      value={value}
      valueExpr="id"
      displayExpr={(d: GmpDocumentOption) => (d ? d.label : '')}
      searchEnabled
      showClearButton
      disabled={disabled}
      placeholder={placeholder}
      width={width}
      noDataText="ไม่มีเอกสาร — สร้างที่เมนู GMP > เอกสาร"
      // Render the option list at document.body. This SelectBox sits inside the
      // SOP-step / IPC inline editor whose card uses overflow/stacking contexts;
      // without container:'body' the popup is clipped by an ancestor on Chrome
      // and the options don't appear (Firefox renders it anyway). This is the
      // same proven fix used by the shared DxSelectBox wrapper.
      dropDownOptions={{ container: 'body' }}
      onValueChanged={(e) => onValueChange(e.value == null ? null : Number(e.value))}
    />
  );
}

export default GmpDocumentSelect;
