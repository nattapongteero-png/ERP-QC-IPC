'use client';

/**
 * CoA OCR Upload — reusable supplier-CoA scanner for Goods Receipt.
 *
 * Drop into any GRN form. The operator uploads a supplier Certificate of
 * Analysis (PDF/image); it is OCR'd + parsed by the BMS AI stack, and the
 * extracted fields are shown for review. On confirm, `onExtracted` fires so the
 * parent can auto-fill lot number, mfg/exp dates, test results, etc.
 *
 * Degrades gracefully: if the AI is unavailable the panel says so and the
 * operator just continues entering data manually.
 */
import { useRef, useState } from 'react';
import { Upload, FileCheck2, AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { CoaExtraction, CoaOcrResult } from '@/types/coa-ocr';

interface CoaOcrUploadProps {
  /** Fires when the operator confirms the extracted data. */
  onExtracted?: (extraction: CoaExtraction, rawText: string | null) => void;
  /** Override the API endpoint if mounted elsewhere. */
  endpoint?: string;
  className?: string;
}

const DEFAULT_ENDPOINT = '/api/inventory/goods-receipts/coa-ocr';
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.tiff,.heic';

export function CoaOcrUpload({ onExtracted, endpoint = DEFAULT_ENDPOINT, className }: CoaOcrUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoaOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(endpoint, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `เกิดข้อผิดพลาด (${res.status})`);
        return;
      }
      const data = (await res.json()) as CoaOcrResult;
      setResult(data);
    } catch {
      setError('ไม่สามารถเชื่อมต่อบริการ OCR ได้');
    } finally {
      setLoading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ''; // allow re-uploading the same file
  }

  const extraction = result?.extraction ?? null;

  return (
    <div className={className} data-testid="coa-ocr-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={onPick}
        style={{ display: 'none' }}
        data-testid="coa-ocr-file-input"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        data-testid="coa-ocr-upload-button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid #93c5fd',
          background: '#fff',
          color: '#1d4ed8',
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
        {loading ? 'กำลังอ่านเอกสาร CoA…' : 'สแกน CoA จากผู้ขาย (AI)'}
      </button>

      {fileName && !loading && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
          <FileCheck2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {fileName}
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="coa-ocr-error"
          style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}
        >
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {error}
        </div>
      )}

      {result?.aiUnavailable && (
        <div
          data-testid="coa-ocr-unavailable"
          style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: 13 }}
        >
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          ระบบ AI ไม่พร้อมใช้งานขณะนี้ — กรุณากรอกข้อมูลด้วยตนเอง
          {result.message ? ` (${result.message})` : ''}
        </div>
      )}

      {extraction && (
        <ExtractionReview
          extraction={extraction}
          onConfirm={() => onExtracted?.(extraction, result?.rawText ?? null)}
        />
      )}
    </div>
  );
}

function field(label: string, value: string | null) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
      <span style={{ minWidth: 120, color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );
}

function ExtractionReview({
  extraction,
  onConfirm,
}: {
  extraction: CoaExtraction;
  onConfirm: () => void;
}) {
  return (
    <div
      data-testid="coa-ocr-result"
      style={{ marginTop: 12, padding: 16, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {field('ผลิตภัณฑ์', extraction.productName)}
        {field('รหัสผู้ขาย', extraction.supplierItemCode)}
        {field('Lot', extraction.lotNumber)}
        {field('Batch', extraction.batchNumber)}
        {field('วันผลิต', extraction.manufactureDate)}
        {field('วันหมดอายุ', extraction.expiryDate)}
        {field('ผู้ผลิต', extraction.manufacturerName)}
        {field('ปริมาณ', extraction.quantity)}
      </div>

      {extraction.testResults.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} data-testid="coa-ocr-tests">
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '4px 8px' }}>พารามิเตอร์</th>
                <th style={{ padding: '4px 8px' }}>ผล</th>
                <th style={{ padding: '4px 8px' }}>เกณฑ์</th>
                <th style={{ padding: '4px 8px' }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {extraction.testResults.map((t, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '4px 8px' }}>{t.parameter}</td>
                  <td style={{ padding: '4px 8px' }}>{t.result}</td>
                  <td style={{ padding: '4px 8px' }}>{t.specification || '—'}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {t.pass === true && <CheckCircle2 size={16} color="#16a34a" />}
                    {t.pass === false && <XCircle size={16} color="#dc2626" />}
                    {t.pass === null && <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OverallBadge overall={extraction.overallResult} />
        <button
          type="button"
          onClick={onConfirm}
          data-testid="coa-ocr-apply-button"
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#16a34a',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ใช้ข้อมูลนี้
        </button>
      </div>

      {extraction.notes && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{extraction.notes}</div>
      )}
    </div>
  );
}

function OverallBadge({ overall }: { overall: CoaExtraction['overallResult'] }) {
  const map = {
    pass: { label: 'ผ่าน', bg: '#dcfce7', fg: '#166534' },
    fail: { label: 'ไม่ผ่าน', bg: '#fee2e2', fg: '#991b1b' },
    unknown: { label: 'ไม่ระบุ', bg: '#f3f4f6', fg: '#6b7280' },
  } as const;
  const s = map[overall];
  return (
    <span
      data-testid="coa-ocr-overall"
      style={{ padding: '4px 12px', borderRadius: 999, background: s.bg, color: s.fg, fontSize: 13, fontWeight: 600 }}
    >
      ผลรวม: {s.label}
    </span>
  );
}
