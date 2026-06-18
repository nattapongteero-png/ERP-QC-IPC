'use client';

/**
 * QC Test Report — printable A4 document (รายงานผลการตรวจสอบคุณภาพ).
 *
 * Replaces the old "print the on-screen card" behaviour on the QC entry detail
 * page. Renders a formal lab report: factory header, sample-info grid, a
 * bordered test-results table, a 4-column 21 CFR Part 11 sign-off block, and a
 * GMP footer.
 *
 * Visibility: the whole document is `hidden` on screen and `print:block` only,
 * so it appears solely when the operator calls window.print(). The on-screen
 * detail UI is wrapped in `print:hidden` by the page, so printing yields just
 * this document.
 *
 * Pure presentational — all data is passed in via `detail`; no fetching, no
 * client state. Spec values stored as JSON envelopes are condensed with
 * `formatSpecInline` so raw JSON never reaches the printed page.
 */

import * as React from 'react';
import { formatSpecInline } from '@/lib/master-data/ipc-spec-payload';

// ── Company / factory header (mirrors other print documents) ──────────────
const FACTORY = {
  nameTh: 'โรงงานผลิตยาสมุนไพร',
  nameEn: 'Herbal Medicine Manufacturing',
  address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  licenseNo: 'GMP-XXXX/XXXX',
};

// ── Minimal shape of the QC sample detail used by this document ───────────
// Kept local because the page's QcSampleDetail type is not exported. Only the
// fields actually printed are declared; extra fields on the real object are
// ignored structurally.
export interface QCPrintTestRow {
  id: number;
  sequence: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
  criteriaType: string | null;
  specText: string | null;
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  unit: string | null;
  testMethod: string | null;
  numericResult: number | null;
  textResult: string | null;
  resultStatus: string;
  testedByName: string | null;
  testedAt: string | null;
}

export interface QCPrintSignature {
  role: string;
  userId: number;
  userName: string | null;
  signedAt: string;
}

export interface QCPrintDetail {
  sampleNumber: string;
  productCode: string | null;
  productName: string | null;
  productNameEn?: string | null;
  lotNumber: string | null;
  sourceType: string;
  sourceRefText: string | null;
  quantityReceived: number | null;
  unit: string | null;
  receivedDate: string;
  receivedByName: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  customerName: string | null;
  salesOrderRef: string | null;
  status: string;
  notes: string | null;
  tests: QCPrintTestRow[];
  signatures: QCPrintSignature[];
}

// ── Formatting helpers ────────────────────────────────────────────────────
function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()} ${hh}:${mm}`;
}

function fmtQty(n: number | null | undefined, unit: string | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n).toLocaleString('th-TH', { maximumFractionDigits: 4 });
  return unit ? `${num} ${unit}` : num;
}

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'raw_material_lot':
      return 'วัตถุดิบเข้า';
    case 'work_order_batch':
      return 'ใบสั่งผลิต';
    case 'customer_return':
      return 'คืนจากลูกค้า';
    case 'stability':
      return 'Stability';
    case 'purchased_herb':
      return 'ซื้อสมุนไพร';
    case 'outgoing_shipment':
      return 'ส่งออกให้ลูกค้า';
    default:
      return sourceType;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    registered: 'ลงทะเบียน',
    testing: 'กำลังทดสอบ',
    reviewed: 'ตรวจทานแล้ว',
    approved: 'อนุมัติแล้ว',
    released: 'ปล่อยใช้งานแล้ว',
    rejected: 'ปฏิเสธ',
    quarantine: 'กักกัน',
    oos: 'OOS / ไม่ผ่านข้อกำหนด',
  };
  return map[status] || status;
}

/** Readable spec — never returns raw JSON (uses formatSpecInline). */
function specDisplay(t: QCPrintTestRow): string {
  const inline = formatSpecInline({
    criteriaType: t.criteriaType,
    specification: t.specText,
    minValue: t.specMin,
    maxValue: t.specMax,
    unit: t.unit,
    maxLen: 120,
  });
  if (inline) return inline;
  if (t.specMin != null && t.specMax != null) {
    return `${t.specMin} – ${t.specMax}${t.unit ? ` ${t.unit}` : ''}`;
  }
  if (t.specMin != null) return `≥ ${t.specMin}${t.unit ? ` ${t.unit}` : ''}`;
  if (t.specMax != null) return `≤ ${t.specMax}${t.unit ? ` ${t.unit}` : ''}`;
  if (t.specTarget != null) return `${t.specTarget}${t.unit ? ` ${t.unit}` : ''}`;
  return '—';
}

function resultDisplay(t: QCPrintTestRow): string {
  if (t.numericResult != null) {
    const num = Number(t.numericResult).toLocaleString('th-TH', { maximumFractionDigits: 4 });
    return t.unit ? `${num} ${t.unit}` : num;
  }
  if (t.textResult) return t.textResult;
  return '—';
}

function conclusionLabel(status: string): string {
  if (status === 'pass') return 'ผ่าน';
  if (status === 'fail') return 'ไม่ผ่าน';
  return 'รอผล';
}

// ── Component ─────────────────────────────────────────────────────────────
export function QCTestPrintDocument({ detail }: { detail: QCPrintDetail }) {
  const sigByRole = new Map<string, QCPrintSignature>();
  for (const s of detail.signatures) sigByRole.set(s.role, s);

  const productLine = (() => {
    const th = detail.productName ?? '';
    const en = detail.productNameEn ?? '';
    const name = th && en && th !== en ? `${th} / ${en}` : th || en || '—';
    return detail.productCode ? `${detail.productCode} — ${name}` : name;
  })();

  const printedAt = new Date();
  const printedAtStr = `${String(printedAt.getDate()).padStart(2, '0')}/${String(
    printedAt.getMonth() + 1,
  ).padStart(2, '0')}/${printedAt.getFullYear()} ${String(printedAt.getHours()).padStart(
    2,
    '0',
  )}:${String(printedAt.getMinutes()).padStart(2, '0')}`;

  const signTiers: Array<{ role: string; label: string }> = [
    { role: 'analyst', label: 'ผู้ทดสอบ / Tested by' },
    { role: 'reviewer', label: 'ผู้ทบทวน / Reviewed by' },
    { role: 'approver', label: 'ผู้อนุมัติ / Approved by' },
    { role: 'qa_release', label: 'QA ปล่อยใช้งาน / Released by' },
  ];

  return (
    <div
      className="hidden print:block qc-test-print"
      data-testid="qc-test-print-document"
    >
      <style>{printCss}</style>

      {/* ───── Header ───── */}
      <div className="qc-print-header">
        <div className="qc-print-company">
          <div className="qc-print-company-name">{FACTORY.nameTh}</div>
          <div className="qc-print-company-en">{FACTORY.nameEn}</div>
          <div className="qc-print-company-meta">{FACTORY.address}</div>
          <div className="qc-print-company-meta">
            ใบอนุญาตผลิต GMP เลขที่ {FACTORY.licenseNo}
          </div>
        </div>
        <div className="qc-print-title-block">
          <div className="qc-print-doc-title">รายงานผลการตรวจสอบคุณภาพ</div>
          <div className="qc-print-doc-title-en">Quality Control Test Report</div>
          <table className="qc-print-meta-table">
            <tbody>
              <tr>
                <td className="qc-print-meta-label">เลขที่ / No.</td>
                <td className="qc-print-meta-value">{detail.sampleNumber}</td>
              </tr>
              <tr>
                <td className="qc-print-meta-label">วันที่พิมพ์ / Printed</td>
                <td className="qc-print-meta-value">{printedAtStr}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── Sample information ───── */}
      <div className="qc-print-section-title">ข้อมูลตัวอย่าง / Sample Information</div>
      <table className="qc-print-info">
        <tbody>
          <tr>
            <td className="qc-print-info-label">รหัสตัวอย่าง</td>
            <td className="qc-print-info-value">{detail.sampleNumber}</td>
            <td className="qc-print-info-label">สถานะ</td>
            <td className="qc-print-info-value">{statusLabel(detail.status)}</td>
          </tr>
          <tr>
            <td className="qc-print-info-label">ผลิตภัณฑ์</td>
            <td className="qc-print-info-value" colSpan={3}>
              {productLine}
            </td>
          </tr>
          <tr>
            <td className="qc-print-info-label">Lot / Batch</td>
            <td className="qc-print-info-value">{detail.lotNumber || '—'}</td>
            <td className="qc-print-info-label">จำนวน</td>
            <td className="qc-print-info-value">
              {fmtQty(detail.quantityReceived, detail.unit)}
            </td>
          </tr>
          <tr>
            <td className="qc-print-info-label">แหล่งที่มา</td>
            <td className="qc-print-info-value">
              {sourceLabel(detail.sourceType)}
              {detail.sourceRefText ? ` · ${detail.sourceRefText}` : ''}
            </td>
            <td className="qc-print-info-label">วันที่รับ</td>
            <td className="qc-print-info-value">{fmtDate(detail.receivedDate)}</td>
          </tr>
          <tr>
            <td className="qc-print-info-label">วันผลิต</td>
            <td className="qc-print-info-value">{fmtDate(detail.manufactureDate)}</td>
            <td className="qc-print-info-label">วันหมดอายุ</td>
            <td className="qc-print-info-value">{fmtDate(detail.expiryDate)}</td>
          </tr>
          {(detail.customerName || detail.receivedByName) && (
            <tr>
              <td className="qc-print-info-label">ผู้รับตัวอย่าง</td>
              <td className="qc-print-info-value">{detail.receivedByName || '—'}</td>
              <td className="qc-print-info-label">ลูกค้า</td>
              <td className="qc-print-info-value">
                {detail.customerName || '—'}
                {detail.salesOrderRef ? ` · ${detail.salesOrderRef}` : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ───── Test results ───── */}
      <div className="qc-print-section-title">ผลการทดสอบ / Test Results</div>
      <table className="qc-print-results">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>ลำดับ</th>
            <th style={{ width: '28%', textAlign: 'left' }}>รายการตรวจ</th>
            <th style={{ width: '24%', textAlign: 'left' }}>ข้อกำหนด</th>
            <th style={{ width: '17%', textAlign: 'left' }}>ผลที่ได้</th>
            <th style={{ width: '10%' }}>สรุป</th>
            <th style={{ width: '16%', textAlign: 'left' }}>ผู้บันทึก</th>
          </tr>
        </thead>
        <tbody>
          {detail.tests.length === 0 ? (
            <tr>
              <td colSpan={6} className="qc-print-empty">
                ไม่มีรายการทดสอบ
              </td>
            </tr>
          ) : (
            detail.tests.map((t) => (
              <tr key={t.id}>
                <td style={{ textAlign: 'center' }}>{t.sequence}</td>
                <td style={{ textAlign: 'left' }}>
                  <span className="qc-print-crit-name">
                    {t.criteriaNameTh || t.criteriaName || `criteria#${t.id}`}
                  </span>
                  {t.criteriaCode && (
                    <span className="qc-print-crit-code"> ({t.criteriaCode})</span>
                  )}
                  {t.testMethod && (
                    <div className="qc-print-crit-method">วิธี: {t.testMethod}</div>
                  )}
                </td>
                <td style={{ textAlign: 'left' }}>{specDisplay(t)}</td>
                <td style={{ textAlign: 'left' }}>{resultDisplay(t)}</td>
                <td
                  style={{ textAlign: 'center' }}
                  className={
                    t.resultStatus === 'fail'
                      ? 'qc-print-fail'
                      : t.resultStatus === 'pass'
                      ? 'qc-print-pass'
                      : ''
                  }
                >
                  {conclusionLabel(t.resultStatus)}
                </td>
                <td style={{ textAlign: 'left' }}>
                  {t.testedByName || '—'}
                  {t.testedAt && (
                    <div className="qc-print-tested-at">{fmtDateTime(t.testedAt)}</div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {detail.notes && (
        <div className="qc-print-notes">
          <div className="qc-print-notes-title">หมายเหตุ / Remarks</div>
          <div className="qc-print-notes-body">{detail.notes}</div>
        </div>
      )}

      {/* ───── Sign-off (21 CFR Part 11) ───── */}
      <div className="qc-print-section-title">
        การลงนาม / Sign-off (21 CFR Part 11)
      </div>
      <div className="qc-print-signs">
        {signTiers.map((tier) => {
          const sig = sigByRole.get(tier.role);
          return (
            <div className="qc-print-sign" key={tier.role}>
              <div className="qc-print-sign-role">{tier.label}</div>
              <div className="qc-print-sign-line" />
              <div className="qc-print-sign-name">
                {sig ? sig.userName ?? `user#${sig.userId}` : '( ................................ )'}
              </div>
              <div className="qc-print-sign-date">
                วันที่ {sig ? fmtDateTime(sig.signedAt) : '......... / ......... / .........'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ───── Footer ───── */}
      <div className="qc-print-footer">
        เอกสารนี้พิมพ์จากระบบ Herbal Medicine ERP · {FACTORY.nameTh} · ควบคุมตามหลักเกณฑ์ GMP
        — ตรวจสอบประวัติการแก้ไข (audit trail) ได้ตามคำขอ
      </div>
    </div>
  );
}

export default QCTestPrintDocument;

// ── Print CSS — black/white, A4, Sarabun, screen-hidden ───────────────────
const printCss = `
.qc-test-print {
  font-family: "Sarabun", "TH Sarabun PSK", "Tahoma", sans-serif;
  color: #000;
  font-size: 11pt;
  line-height: 1.4;
}
.qc-test-print table { border-collapse: collapse; width: 100%; }
.qc-test-print td, .qc-test-print th { vertical-align: top; }

.qc-print-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  border-bottom: 2px solid #000;
  padding-bottom: 10px;
}
.qc-print-company-name { font-size: 16pt; font-weight: 700; }
.qc-print-company-en { font-size: 10pt; font-weight: 600; }
.qc-print-company-meta { font-size: 9pt; }
.qc-print-title-block { text-align: right; min-width: 46%; }
.qc-print-doc-title { font-size: 15pt; font-weight: 700; }
.qc-print-doc-title-en { font-size: 11pt; font-weight: 600; margin-bottom: 4px; }
.qc-print-meta-table { width: auto; margin-left: auto; }
.qc-print-meta-table td { border: 1px solid #000; padding: 2px 8px; font-size: 9.5pt; }
.qc-print-meta-label { font-weight: 600; background: #f0f0f0; white-space: nowrap; }
.qc-print-meta-value { text-align: left; }

.qc-print-section-title {
  margin-top: 12px;
  margin-bottom: 4px;
  font-size: 11pt;
  font-weight: 700;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
}

.qc-print-info td { border: 1px solid #000; padding: 4px 8px; font-size: 10pt; }
.qc-print-info-label { font-weight: 600; background: #f0f0f0; width: 16%; white-space: nowrap; }
.qc-print-info-value { width: 34%; }

.qc-print-results { font-size: 10pt; }
.qc-print-results th {
  border: 1px solid #000;
  background: #e8e8e8;
  padding: 5px 6px;
  text-align: center;
  font-weight: 700;
}
.qc-print-results td { border: 1px solid #000; padding: 4px 6px; }
.qc-print-results tr { break-inside: avoid; page-break-inside: avoid; }
.qc-print-crit-name { font-weight: 600; }
.qc-print-crit-code { font-size: 9pt; }
.qc-print-crit-method { font-size: 8.5pt; color: #333; margin-top: 1px; }
.qc-print-tested-at { font-size: 8.5pt; color: #333; }
.qc-print-empty { text-align: center; padding: 10px; font-style: italic; }
.qc-print-pass { font-weight: 700; }
.qc-print-fail { font-weight: 700; text-decoration: underline; }

.qc-print-notes {
  margin-top: 10px;
  border: 1px solid #000;
  padding: 6px 8px;
  font-size: 9.5pt;
  break-inside: avoid;
}
.qc-print-notes-title { font-weight: 700; margin-bottom: 2px; }
.qc-print-notes-body { white-space: pre-line; }

.qc-print-signs {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  break-inside: avoid;
  page-break-inside: avoid;
}
.qc-print-sign {
  flex: 1;
  border: 1px solid #000;
  padding: 8px;
  min-height: 96px;
  text-align: center;
}
.qc-print-sign-role { font-size: 9pt; font-weight: 600; margin-bottom: 26px; }
.qc-print-sign-line { border-bottom: 1px dotted #000; margin: 0 6px 4px; height: 1px; }
.qc-print-sign-name { font-size: 9.5pt; font-weight: 600; }
.qc-print-sign-date { font-size: 8.5pt; margin-top: 2px; }

.qc-print-footer {
  margin-top: 14px;
  padding-top: 6px;
  border-top: 1px solid #000;
  font-size: 8.5pt;
  text-align: center;
}

@media print {
  @page { size: A4; margin: 12mm; }
  .qc-test-print {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
