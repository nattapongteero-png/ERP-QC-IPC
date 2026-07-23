'use client';

/**
 * Purchase Order — printable document (ใบสั่งซื้อ).
 *
 * Standard PO layout for real-world use: buyer (company) header, PO meta,
 * vendor + ship-to blocks, line-items table, VAT totals + amount in Thai
 * words, terms, and a 3-way signature block (ผู้จัดทำ / ผู้ตรวจสอบ / ผู้อนุมัติ).
 *
 * Rendered with the `.print-only` class so it is hidden on screen and only
 * appears when the user prints (window.print()). The on-screen detail UI is
 * wrapped in `.no-print` by the page, so printing yields just this document.
 *
 * Pure presentational component — all data is passed in; no fetching.
 */

const VAT_RATE = 0.07;

// Buyer (our company) — mirrors the constant used in accounting reports.
// Centralize here if a company-profile settings page is added later.
const COMPANY = {
  nameTh: 'บริษัท สมุนไพรไทย จำกัด',
  nameEn: 'Herbal Medicine Co., Ltd.',
  address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  taxId: '0105555000001',
  branch: 'สำนักงานใหญ่',
  phone: '02-123-4567',
  email: 'purchasing@herbal-erp.com',
};

export interface POPrintLine {
  id: number;
  itemCode: string;
  itemName: string;
  itemNameEn?: string;
  quantity: number;
  unit?: string;
  itemUnit?: string;
  unitPrice: number;
  lineTotal: number;
}

export interface POPrintData {
  poNumber: string;
  statusTh: string;
  vendorName: string;
  vendorCode?: string;
  vendorContact?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  orderDate: string | null;
  expectedDate: string | null;
  paymentTerms?: string;
  shippingAddress?: string;
  notes?: string;
  lines: POPrintLine[];
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  /** Thai baht text of grandTotal, e.g. "ห้าแสนสามหมื่นห้าพันบาทถ้วน" */
  grandTotalText: string;
  /** Names for the signature block — filled in from the PO's audit trail so the
      lines aren't blank. Any missing name falls back to a blank signature line. */
  preparedByName?: string | null;
  checkedByName?: string | null;
  approvedByName?: string | null;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function fmtQty(n: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n || 0);
}

function fmtDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function POPrintDocument({ data }: { data: POPrintData }) {
  return (
    <div className="print-only print-doc po-print" id="po-print-document">
      {/* ───────── Header: buyer + document title ───────── */}
      <div className="po-print-header">
        <div className="po-print-company">
          <div className="po-print-company-name">{COMPANY.nameTh}</div>
          <div className="po-print-company-en">{COMPANY.nameEn}</div>
          <div className="po-print-company-meta">{COMPANY.address}</div>
          <div className="po-print-company-meta">
            เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} ({COMPANY.branch})
          </div>
          <div className="po-print-company-meta">
            โทร. {COMPANY.phone} · อีเมล {COMPANY.email}
          </div>
        </div>
        <div className="po-print-title-block">
          <div className="po-print-doc-title">ใบสั่งซื้อ</div>
          <div className="po-print-doc-title-en">PURCHASE ORDER</div>
          <table className="po-print-meta-table">
            <tbody>
              <tr>
                <td className="po-print-meta-label">เลขที่ / No.</td>
                <td className="po-print-meta-value">{data.poNumber}</td>
              </tr>
              <tr>
                <td className="po-print-meta-label">วันที่ / Date</td>
                <td className="po-print-meta-value">{fmtDate(data.orderDate)}</td>
              </tr>
              <tr>
                <td className="po-print-meta-label">สถานะ / Status</td>
                <td className="po-print-meta-value">{data.statusTh}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────── Vendor + Ship-to ───────── */}
      <div className="po-print-parties">
        <div className="po-print-party">
          <div className="po-print-party-title">ผู้ขาย / Vendor</div>
          <div className="po-print-party-name">{data.vendorName}</div>
          {data.vendorCode && (
            <div className="po-print-party-line">รหัสผู้ขาย: {data.vendorCode}</div>
          )}
          {data.vendorContact && (
            <div className="po-print-party-line">ผู้ติดต่อ: {data.vendorContact}</div>
          )}
          {data.vendorPhone && (
            <div className="po-print-party-line">โทร. {data.vendorPhone}</div>
          )}
          {data.vendorEmail && (
            <div className="po-print-party-line">อีเมล: {data.vendorEmail}</div>
          )}
        </div>
        <div className="po-print-party">
          <div className="po-print-party-title">สถานที่จัดส่ง / Ship To</div>
          <div className="po-print-party-name">{COMPANY.nameTh}</div>
          <div className="po-print-party-line">
            {data.shippingAddress || COMPANY.address}
          </div>
          <div className="po-print-party-line">
            กำหนดส่งมอบ: <strong>{fmtDate(data.expectedDate)}</strong>
          </div>
          <div className="po-print-party-line">
            เงื่อนไขชำระเงิน: {data.paymentTerms || '-'}
          </div>
        </div>
      </div>

      {/* ───────── Line items ───────── */}
      <table className="po-print-items">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>ลำดับ</th>
            <th style={{ width: '15%' }}>รหัส</th>
            <th style={{ textAlign: 'left' }}>รายการ</th>
            <th style={{ width: '12%' }}>จำนวน</th>
            <th style={{ width: '8%' }}>หน่วย</th>
            <th style={{ width: '14%' }}>ราคา/หน่วย</th>
            <th style={{ width: '16%' }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, idx) => (
            <tr key={l.id}>
              <td style={{ textAlign: 'center' }}>{idx + 1}</td>
              <td>{l.itemCode}</td>
              <td style={{ textAlign: 'left' }}>
                {l.itemName}
                {l.itemNameEn && (
                  <span className="po-print-item-en"> ({l.itemNameEn})</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>{fmtQty(l.quantity)}</td>
              <td style={{ textAlign: 'center' }}>{l.unit || l.itemUnit || '-'}</td>
              <td style={{ textAlign: 'right' }}>{fmtMoney(l.unitPrice)}</td>
              <td style={{ textAlign: 'right' }}>{fmtMoney(l.lineTotal)}</td>
            </tr>
          ))}
          {/* Pad to a minimum number of rows so the document keeps its shape
              when there are only a few lines */}
          {Array.from({ length: Math.max(0, 8 - data.lines.length) }).map((_, i) => (
            <tr key={`pad-${i}`} className="po-print-pad-row">
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ───────── Totals + amount in words ───────── */}
      <div className="po-print-summary">
        <div className="po-print-words">
          <span className="po-print-words-label">จำนวนเงินรวมทั้งสิ้น (ตัวอักษร)</span>
          <span className="po-print-words-value">({data.grandTotalText})</span>
        </div>
        <table className="po-print-totals">
          <tbody>
            <tr>
              <td className="po-print-total-label">รวมเป็นเงิน</td>
              <td className="po-print-total-value">{fmtMoney(data.subtotal)}</td>
            </tr>
            <tr>
              <td className="po-print-total-label">
                ภาษีมูลค่าเพิ่ม {(VAT_RATE * 100).toFixed(0)}%
              </td>
              <td className="po-print-total-value">{fmtMoney(data.vatAmount)}</td>
            </tr>
            <tr className="po-print-grand">
              <td className="po-print-total-label">จำนวนเงินรวมทั้งสิ้น</td>
              <td className="po-print-total-value">{fmtMoney(data.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ───────── Notes / terms ───────── */}
      {data.notes && (
        <div className="po-print-notes">
          <div className="po-print-notes-title">หมายเหตุ / Remarks</div>
          <div className="po-print-notes-body">{data.notes}</div>
        </div>
      )}

      {/* ───────── Signatures ─────────
          Names are filled from the PO record (creator / approver) so the
          เอกสาร shows who actually prepared & approved it instead of blank
          lines. A missing name leaves the dotted line for a wet signature. */}
      <div className="po-print-signs">
        {[
          { th: 'ผู้จัดทำ', en: 'Prepared by', name: data.preparedByName },
          { th: 'ผู้ตรวจสอบ', en: 'Checked by', name: data.checkedByName },
          { th: 'ผู้อนุมัติ', en: 'Approved by', name: data.approvedByName },
        ].map((s) => (
          <div className="po-print-sign" key={s.en}>
            <div className="po-print-sign-line" />
            <div className="po-print-sign-name">
              {s.name ? `( ${s.name} )` : '( ........................................ )'}
            </div>
            <div className="po-print-sign-role">
              {s.th} / {s.en}
            </div>
            <div className="po-print-sign-date">วันที่ ......... / ......... / .........</div>
          </div>
        ))}
      </div>

      <div className="po-print-footer">
        เอกสารนี้พิมพ์จากระบบ Herbal Medicine ERP · {COMPANY.nameTh}
      </div>
    </div>
  );
}

export default POPrintDocument;
