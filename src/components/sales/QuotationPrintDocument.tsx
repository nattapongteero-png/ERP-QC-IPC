/**
 * Quotation Printable Document (ใบเสนอราคา)
 *
 * Hidden on screen (`.print-only`) and revealed by the browser print flow via
 * the global `@media print` rules in globals.css — same mechanism as the
 * delivery note and sales order documents.
 *
 * Unlike the delivery note, a quotation IS a money document: it carries unit
 * prices, line amounts and a grand total, because it is the offer the customer
 * decides on. All numbers go through formatNumber() so server and client render
 * identically and thousands separators are always present.
 */

'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/utils/number-format';
import { calcLineVat } from '@/lib/utils/vat';
import type { QuotationWithLines } from '@/types/quotation';

interface CompanyInfo {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function QuotationPrintDocument({ quotation }: { quotation: QuotationWithLines }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/company')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.success) setCompany(json.data);
      })
      .catch(() => {
        // A missing company block must not stop the quotation printing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rawGoods = quotation.lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0,
  );
  // Quotations printed without any VAT line before — a tax-registered seller's
  // quote must still show base + VAT + total (ม.86/4). Honour the inclusive flag.
  const qtVat = calcLineVat(rawGoods, quotation.vatInclusive === true);
  const beforeVat = qtVat.base;
  const vatAmount = qtVat.vat;
  const total = qtVat.total;

  return (
    <div className="print-only print-doc qt-print-doc" data-testid="qt-print-document">
      <style jsx>{`
        .qt-print-doc {
          font-family: var(--font-sarabun), 'TH Sarabun New', 'Leelawadee UI', Tahoma, 'Noto Sans Thai', sans-serif;
          color: #000;
          padding: 16mm;
          font-size: 12pt;
        }
        .qt-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .qt-title { font-size: 20pt; font-weight: 700; text-align: right; }
        .qt-meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; }
        .qt-block { flex: 1; }
        .qt-label { font-size: 10pt; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11pt; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: 700; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .qt-terms { margin-top: 12px; font-size: 10pt; }
        .qt-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
        .qt-sign div { flex: 1; text-align: center; }
        .qt-sign-line { border-top: 1px solid #000; margin-top: 44px; padding-top: 6px; font-size: 10pt; }
      `}</style>

      <div className="qt-head">
        <div>
          <div style={{ fontSize: '14pt', fontWeight: 700 }}>
            {company?.companyNameTh || company?.companyName || ''}
          </div>
          {company?.address && <div style={{ fontSize: '10pt' }}>{company.address}</div>}
          {(company?.phone || company?.email) && (
            <div style={{ fontSize: '10pt' }}>
              {company?.phone && <>โทร. {company.phone}</>}
              {company?.phone && company?.email && ' · '}
              {company?.email}
            </div>
          )}
          {company?.taxId && (
            <div style={{ fontSize: '10pt' }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>
          )}
        </div>
        <div className="qt-title">
          ใบเสนอราคา
          <div style={{ fontSize: '10pt', fontWeight: 400 }}>Quotation</div>
        </div>
      </div>

      <div className="qt-meta">
        <div className="qt-block">
          <div className="qt-label">ลูกค้า / Customer</div>
          <div style={{ fontWeight: 700 }}>{quotation.customerName || '-'}</div>
          {quotation.customerAddress && (
            <div style={{ fontSize: '10pt' }}>{quotation.customerAddress}</div>
          )}
          {quotation.customerContact && (
            <div style={{ fontSize: '10pt' }}>ผู้ติดต่อ: {quotation.customerContact}</div>
          )}
        </div>
        <div className="qt-block" style={{ maxWidth: '46%' }}>
          <div><span className="qt-label">เลขที่ใบเสนอราคา:</span> <b>{quotation.quotationNumber}</b></div>
          <div><span className="qt-label">วันที่:</span> {formatThaiDate(quotation.quotationDate)}</div>
          <div><span className="qt-label">ใช้ได้ถึง:</span> {formatThaiDate(quotation.validUntil)}</div>
          {quotation.paymentTerms && (
            <div><span className="qt-label">เงื่อนไขการชำระ:</span> {quotation.paymentTerms}</div>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '14%' }}>รหัสสินค้า</th>
            <th>รายละเอียด</th>
            <th className="num" style={{ width: '12%' }}>จำนวน</th>
            <th style={{ width: '8%' }}>หน่วย</th>
            <th className="num" style={{ width: '15%' }}>ราคา/หน่วย</th>
            <th className="num" style={{ width: '16%' }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {quotation.lines.map((l, i) => {
            const amount = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
            return (
              <tr key={l.id ?? i}>
                <td className="num">{i + 1}</td>
                <td>{l.itemCode || '-'}</td>
                <td>{l.description}</td>
                <td className="num">{formatNumber(l.quantity)}</td>
                <td>{l.unit}</td>
                <td className="num">{formatNumber(l.unitPrice)}</td>
                <td className="num">{formatNumber(amount)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={6} style={{ textAlign: 'right' }}>มูลค่าก่อนภาษี (บาท)</td>
            <td className="num">{formatNumber(beforeVat)}</td>
          </tr>
          <tr>
            <td colSpan={6} style={{ textAlign: 'right' }}>ภาษีมูลค่าเพิ่ม / VAT 7% (บาท)</td>
            <td className="num">{formatNumber(vatAmount)}</td>
          </tr>
          <tr>
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>ยอดรวมทั้งสิ้น (บาท)</td>
            <td className="num" style={{ fontWeight: 700 }}>{formatNumber(total)}</td>
          </tr>
        </tbody>
      </table>

      {quotation.notes && <div className="qt-terms">หมายเหตุ: {quotation.notes}</div>}
      <div className="qt-terms">
        ใบเสนอราคานี้มีผลถึงวันที่ {formatThaiDate(quotation.validUntil)}
      </div>

      <div className="qt-sign">
        <div>
          <div className="qt-sign-line">ผู้เสนอราคา / Offered by</div>
        </div>
        <div>
          <div className="qt-sign-line">ผู้อนุมัติ / Approved by</div>
        </div>
        <div>
          <div className="qt-sign-line">ลูกค้า / Customer</div>
        </div>
      </div>
    </div>
  );
}
