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
  currentVersionId: number | null;
}

interface GmpDocumentSelectProps {
  value: number | null;
  onValueChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  width?: number | string;
  /** Restrict to active documents only (default true). */
  activeOnly?: boolean;
}

// Module-level cache so the list is fetched once and shared across rows.
let _cache: GmpDocumentOption[] | null = null;
let _inflight: Promise<GmpDocumentOption[]> | null = null;

async function loadDocuments(activeOnly: boolean): Promise<GmpDocumentOption[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const qs = new URLSearchParams({ limit: '1000', ...(activeOnly ? { status: 'active' } : {}) });
    const res = await fetch(`/api/documents?${qs}`);
    if (!res.ok) return [];
    const body = await res.json();
    const docs = body?.data?.documents ?? body?.documents ?? [];
    _cache = docs.map((d: any) => ({
      id: Number(d.id),
      documentNumber: String(d.documentNumber ?? ''),
      title: String(d.title ?? ''),
      currentVersionId: d.currentVersionId != null ? Number(d.currentVersionId) : null,
    }));
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
  activeOnly = true,
}: GmpDocumentSelectProps) {
  const [options, setOptions] = useState<GmpDocumentOption[]>(_cache ?? []);

  useEffect(() => {
    let alive = true;
    loadDocuments(activeOnly).then((opts) => {
      if (alive) setOptions(opts);
    });
    return () => {
      alive = false;
    };
  }, [activeOnly]);

  return (
    <SelectBox
      dataSource={options}
      value={value}
      valueExpr="id"
      displayExpr={(d: GmpDocumentOption) => (d ? `${d.documentNumber} — ${d.title}` : '')}
      searchEnabled
      showClearButton
      disabled={disabled}
      placeholder={placeholder}
      width={width}
      noDataText="ไม่มีเอกสาร — สร้างที่เมนู GMP > เอกสาร"
      onValueChanged={(e) => onValueChange(e.value == null ? null : Number(e.value))}
    />
  );
}

export default GmpDocumentSelect;
