/**
 * AP Invoice Printable Document (ใบแจ้งหนี้เจ้าหนี้ / ใบตั้งหนี้)
 *
 * Hidden on screen (`.print-only`) and revealed by the browser print flow via
 * the global `@media print` rules in globals.css — same mechanism as the AR
 * invoice, receipt, quotation and delivery-note documents.
 *
 * This is the vendor-side (accounts payable) counterpart of the AR invoice. It
 * is what the factory prints as its internal record of a supplier's bill / of
 * the payable it has booked. Unlike the AR invoice we do NOT title it
 * "ใบกำกับภาษี": the legal tax invoice is issued by the *supplier*, not by us —
 * so this document only records the supplier's tax id (ผู้ขาย) alongside ours
 * (ผู้ซื้อ), the amount before VAT, the input VAT (ภาษีซื้อ 7%), the
 * withholding tax (ภาษีหัก ณ ที่จ่าย) when present, and the net payable. The
 * net payable amount is spelt out in Thai baht text as is standard for Thai
 * financial documents. Every number goes through formatNumber().
 */

'use client';

import { useEffect, useState } from 'react';
import { formatNumber, formatMoney } from '@/lib/utils/number-format';
import { thaiBahtText } from '@/lib/utils/thai-baht-text';

interface CompanyInfo {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

export interface APInvoicePrintLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface APInvoiceVendor {
  name?: string | null;
  taxId?: string | null;
  address?: string | null;
  contactPerson?: string | null;
}

export interface APInvoicePrintData {
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  receivedDate?: string | null;
  description?: string | null;
  subtotal: number;
  vatAmount: number;
  /** Withholding tax deducted at source — 0 when not applicable. */
  whtAmount?: number | null;
  totalAmount: number;
  paidAmount?: number | null;
  lines: APInvoicePrintLine[];
  /** Resolved on the page from the vendors list — may be partial. */
  vendor?: APInvoiceVendor | null;
}

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function APInvoicePrintDocument({ invoice }: { invoice: APInvoicePrintData }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/company')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.success) setCompany(json.data);
      })
      .catch(() => {
        // A missing company block must not stop the invoice printing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendor = invoice.vendor;
  const wht = Number(invoice.whtAmount) || 0;
  // Net amount actually payable = total (incl. VAT) minus tax withheld at source.
  const netPayable = Number(invoice.totalAmount) - wht;
  const outstanding = netPayable - (Number(invoice.paidAmount) || 0);

  return (
    <div className="print-only print-doc api-print-doc" data-testid="api-print-document" data-build="ap-print-doc-20260727">
      <style jsx>{`
        .api-print-doc {
          font-family: var(--font-sarabun), 'TH Sarabun New', 'Leelawadee UI', Tahoma, 'Noto Sans Thai', sans-serif;
          color: #000;
          padding: 16mm;
          font-size: 12pt;
        }
        .api-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .api-title { font-size: 18pt; font-weight: 700; text-align: right; }
        .api-meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; }
        .api-block { flex: 1; }
        .api-label { font-size: 10pt; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11pt; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: 700; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .api-totals { margin-top: 12px; display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
        .api-amount-text { flex: 1; border: 1.5px solid #000; padding: 10px 12px; font-size: 11pt; align-self: stretch; }
        .api-totals table { width: auto; min-width: 320px; margin-top: 0; }
        .api-totals td { border: none; padding: 3px 8px; }
        .api-totals td.num { border: none; }
        .api-grand td { border-top: 1.5px solid #000; font-weight: 700; font-size: 12pt; }
        .api-notes { margin-top: 12px; font-size: 10pt; }
        .api-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
        .api-sign div { flex: 1; text-align: center; }
        .api-sign-line { border-top: 1px solid #000; margin-top: 44px; padding-top: 6px; font-size: 10pt; }
      `}</style>

      <div className="api-head">
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
            <div style={{ fontSize: '10pt' }}>เลขประจำตัวผู้เสียภาษี (ผู้ซื้อ): {company.taxId}</div>
          )}
        </div>
        <div className="api-title">
          ใบแจ้งหนี้เจ้าหนี้
          <div style={{ fontSize: '10pt', fontWeight: 400 }}>Purchase Invoice / A/P Voucher</div>
        </div>
      </div>

      <div className="api-meta">
        <div className="api-block">
          <div className="api-label">ผู้ขาย / เจ้าหนี้ (Vendor)</div>
          <div style={{ fontWeight: 700 }}>{vendor?.name || '-'}</div>
          {vendor?.address && <div style={{ fontSize: '10pt' }}>{vendor.address}</div>}
          {vendor?.contactPerson && (
            <div style={{ fontSize: '10pt' }}>ผู้ติดต่อ: {vendor.contactPerson}</div>
          )}
          {vendor?.taxId && (
            <div style={{ fontSize: '10pt' }}>เลขประจำตัวผู้เสียภาษี: {vendor.taxId}</div>
          )}
        </div>
        <div className="api-block" style={{ maxWidth: '46%' }}>
          <div><span className="api-label">เลขที่ใบแจ้งหนี้:</span> <b>{invoice.invoiceNumber}</b></div>
          <div><span className="api-label">วันที่ในเอกสาร:</span> {formatThaiDate(invoice.invoiceDate)}</div>
          {invoice.receivedDate && (
            <div><span className="api-label">วันที่รับเอกสาร:</span> {formatThaiDate(invoice.receivedDate)}</div>
          )}
          <div><span className="api-label">ครบกำหนดชำระ:</span> {formatThaiDate(invoice.dueDate)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th>รายการ</th>
            <th className="num" style={{ width: '12%' }}>จำนวน</th>
            <th className="num" style={{ width: '16%' }}>ราคาต่อหน่วย</th>
            <th className="num" style={{ width: '18%' }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => {
            const amount =
              Number(l.amount) ||
              (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
            return (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td>{l.description || '-'}</td>
                <td className="num">{formatNumber(l.quantity)}</td>
                <td className="num">{formatMoney(l.unitPrice)}</td>
                <td className="num">{formatMoney(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="api-totals">
        <div className="api-amount-text">
          จำนวนเงินสุทธิที่ต้องชำระ (ตัวอักษร):<br />
          <b>{thaiBahtText(netPayable)}</b>
        </div>
        <table>
          <tbody>
            <tr>
              <td>มูลค่าก่อนภาษี</td>
              <td className="num">{formatMoney(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td>ภาษีมูลค่าเพิ่ม 7%</td>
              <td className="num">{formatMoney(invoice.vatAmount)}</td>
            </tr>
            <tr>
              <td>รวมเป็นเงิน</td>
              <td className="num">{formatMoney(invoice.totalAmount)}</td>
            </tr>
            {wht > 0 && (
              <tr>
                <td>หัก ภาษี ณ ที่จ่าย</td>
                <td className="num">-{formatMoney(wht)}</td>
              </tr>
            )}
            <tr className="api-grand">
              <td>ยอดสุทธิที่ต้องชำระ</td>
              <td className="num">{formatMoney(netPayable)}</td>
            </tr>
            {Number(invoice.paidAmount) > 0 && (
              <>
                <tr>
                  <td>ชำระแล้ว</td>
                  <td className="num">{formatMoney(invoice.paidAmount)}</td>
                </tr>
                <tr>
                  <td>ยอดคงค้าง</td>
                  <td className="num">{formatMoney(outstanding)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {invoice.description && <div className="api-notes">หมายเหตุ: {invoice.description}</div>}

      <div className="api-sign">
        <div>
          <div className="api-sign-line">ผู้จัดทำ / Prepared by</div>
        </div>
        <div>
          <div className="api-sign-line">ผู้ตรวจสอบ / Checked by</div>
        </div>
        <div>
          <div className="api-sign-line">ผู้มีอำนาจอนุมัติ / Approved by</div>
        </div>
      </div>
    </div>
  );
}
