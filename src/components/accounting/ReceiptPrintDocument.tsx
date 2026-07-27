/**
 * Receipt Printable Document (ใบเสร็จรับเงิน)
 *
 * Hidden on screen (`.print-only`) and revealed by the browser print flow via
 * the global `@media print` rules in globals.css — same mechanism as the
 * quotation, invoice and delivery note documents.
 *
 * A receipt is the proof the customer paid: it records WHO paid, HOW (เงินสด /
 * โอน / เช็ค), HOW MUCH, and WHICH invoice it settled. The amount is also
 * spelled out in Thai baht text (จำนวนเงินเป็นตัวอักษร) as is standard for Thai
 * financial documents. Every number goes through formatNumber().
 */

'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/utils/number-format';
import { thaiBahtText } from '@/lib/utils/thai-baht-text';

interface CompanyInfo {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

export interface ReceiptPrintData {
  receiptNumber: string;
  receiptDate?: string | null;
  customerName?: string | null;
  paymentMethod?: string | null;
  amount: number;
  /** Bank/cheque or other reference text captured on the payment. */
  reference?: string | null;
  description?: string | null;
  /** The invoice this receipt settled, when known. */
  invoiceNumber?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'เงินสด',
  transfer: 'เงินโอน',
  bank_transfer: 'เงินโอน',
  cheque: 'เช็ค',
  check: 'เช็ค',
  credit_card: 'บัตรเครดิต',
  other: 'อื่นๆ',
};

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ReceiptPrintDocument({ receipt }: { receipt: ReceiptPrintData }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/company')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.success) setCompany(json.data);
      })
      .catch(() => {
        // A missing company block must not stop the receipt printing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const methodLabel = receipt.paymentMethod
    ? METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod
    : '-';

  return (
    <div className="print-only print-doc rc-print-doc" data-testid="rc-print-document">
      <style jsx>{`
        .rc-print-doc {
          font-family: var(--font-sarabun), 'TH Sarabun New', 'Leelawadee UI', Tahoma, 'Noto Sans Thai', sans-serif;
          color: #000;
          padding: 16mm;
          font-size: 12pt;
        }
        .rc-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .rc-title { font-size: 18pt; font-weight: 700; text-align: right; }
        .rc-meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; }
        .rc-block { flex: 1; }
        .rc-label { font-size: 10pt; color: #444; }
        .rc-row { margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11pt; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: 700; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .rc-amount-box { margin-top: 16px; display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; padding: 10px 14px; }
        .rc-amount-text { font-size: 11pt; }
        .rc-amount-num { font-size: 16pt; font-weight: 700; font-variant-numeric: tabular-nums; }
        .rc-notes { margin-top: 12px; font-size: 10pt; }
        .rc-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
        .rc-sign div { flex: 1; text-align: center; }
        .rc-sign-line { border-top: 1px solid #000; margin-top: 44px; padding-top: 6px; font-size: 10pt; }
      `}</style>

      <div className="rc-head">
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
        <div className="rc-title">
          ใบเสร็จรับเงิน
          <div style={{ fontSize: '10pt', fontWeight: 400 }}>Receipt</div>
        </div>
      </div>

      <div className="rc-meta">
        <div className="rc-block">
          <div className="rc-label">ได้รับเงินจาก / Received from</div>
          <div style={{ fontWeight: 700 }}>{receipt.customerName || '-'}</div>
        </div>
        <div className="rc-block" style={{ maxWidth: '46%' }}>
          <div><span className="rc-label">เลขที่ใบเสร็จ:</span> <b>{receipt.receiptNumber}</b></div>
          <div><span className="rc-label">วันที่:</span> {formatThaiDate(receipt.receiptDate)}</div>
          {receipt.invoiceNumber && (
            <div><span className="rc-label">อ้างอิงใบแจ้งหนี้:</span> {receipt.invoiceNumber}</div>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>รายการ</th>
            <th style={{ width: '22%' }}>วิธีการชำระ</th>
            <th className="num" style={{ width: '22%' }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              ชำระค่าสินค้า/บริการ
              {receipt.invoiceNumber ? ` ตามใบแจ้งหนี้ ${receipt.invoiceNumber}` : ''}
              {receipt.reference ? ` (อ้างอิง: ${receipt.reference})` : ''}
            </td>
            <td>{methodLabel}</td>
            <td className="num">{formatNumber(receipt.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="rc-amount-box">
        <div className="rc-amount-text">
          จำนวนเงินที่รับ (ตัวอักษร): <b>{thaiBahtText(Number(receipt.amount) || 0)}</b>
        </div>
        <div className="rc-amount-num">{formatNumber(receipt.amount)} บาท</div>
      </div>

      {receipt.description && <div className="rc-notes">หมายเหตุ: {receipt.description}</div>}

      <div className="rc-sign">
        <div>
          <div className="rc-sign-line">ผู้รับเงิน / Received by</div>
        </div>
        <div>
          <div className="rc-sign-line">ผู้มีอำนาจลงนาม / Authorized</div>
        </div>
      </div>
    </div>
  );
}
