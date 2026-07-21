/**
 * AR Invoice / Tax Invoice Printable Document (ใบกำกับภาษี / ใบแจ้งหนี้)
 *
 * Hidden on screen (`.print-only`) and revealed by the browser print flow via
 * the global `@media print` rules in globals.css — same mechanism as the
 * quotation and delivery note documents.
 *
 * This IS a money document AND a legal tax document: it must show the seller's
 * and the buyer's tax IDs, the tax-invoice number (เลขที่ใบกำกับภาษี), the line
 * amounts, the VAT (ภาษีมูลค่าเพิ่ม 7%) and the grand total. Every number goes
 * through formatNumber() so the server and client render identically and
 * thousands separators are always present.
 */

'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/utils/number-format';

interface CompanyInfo {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

export interface ARInvoicePrintLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount?: number | null;
}

export interface ARInvoiceCustomer {
  name?: string | null;
  taxId?: string | null;
  address?: string | null;
  contactPerson?: string | null;
}

export interface ARInvoicePrintData {
  invoiceNumber: string;
  taxInvoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  description?: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount?: number | null;
  lines: ARInvoicePrintLine[];
  /** Resolved on the page from the customers list — may be partial. */
  customer?: ARInvoiceCustomer | null;
}

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ARInvoicePrintDocument({ invoice }: { invoice: ARInvoicePrintData }) {
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

  const customer = invoice.customer;
  const outstanding =
    Number(invoice.totalAmount) - (Number(invoice.paidAmount) || 0);

  return (
    <div className="print-only ari-print-doc" data-testid="ari-print-document">
      <style jsx>{`
        .ari-print-doc {
          font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
          color: #000;
          padding: 16mm;
          font-size: 12pt;
        }
        .ari-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .ari-title { font-size: 18pt; font-weight: 700; text-align: right; }
        .ari-meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; }
        .ari-block { flex: 1; }
        .ari-label { font-size: 10pt; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11pt; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: 700; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .ari-totals { margin-top: 12px; display: flex; justify-content: flex-end; }
        .ari-totals table { width: auto; min-width: 320px; margin-top: 0; }
        .ari-totals td { border: none; padding: 3px 8px; }
        .ari-totals td.num { border: none; }
        .ari-grand td { border-top: 1.5px solid #000; font-weight: 700; font-size: 12pt; }
        .ari-notes { margin-top: 12px; font-size: 10pt; }
        .ari-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
        .ari-sign div { flex: 1; text-align: center; }
        .ari-sign-line { border-top: 1px solid #000; margin-top: 44px; padding-top: 6px; font-size: 10pt; }
      `}</style>

      <div className="ari-head">
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
        <div className="ari-title">
          ใบกำกับภาษี / ใบแจ้งหนี้
          <div style={{ fontSize: '10pt', fontWeight: 400 }}>Tax Invoice / Invoice</div>
        </div>
      </div>

      <div className="ari-meta">
        <div className="ari-block">
          <div className="ari-label">ลูกค้า / Customer</div>
          <div style={{ fontWeight: 700 }}>{customer?.name || '-'}</div>
          {customer?.address && <div style={{ fontSize: '10pt' }}>{customer.address}</div>}
          {customer?.contactPerson && (
            <div style={{ fontSize: '10pt' }}>ผู้ติดต่อ: {customer.contactPerson}</div>
          )}
          {customer?.taxId && (
            <div style={{ fontSize: '10pt' }}>เลขประจำตัวผู้เสียภาษี: {customer.taxId}</div>
          )}
        </div>
        <div className="ari-block" style={{ maxWidth: '46%' }}>
          <div><span className="ari-label">เลขที่ใบแจ้งหนี้:</span> <b>{invoice.invoiceNumber}</b></div>
          {invoice.taxInvoiceNumber && (
            <div><span className="ari-label">เลขที่ใบกำกับภาษี:</span> <b>{invoice.taxInvoiceNumber}</b></div>
          )}
          <div><span className="ari-label">วันที่:</span> {formatThaiDate(invoice.invoiceDate)}</div>
          <div><span className="ari-label">ครบกำหนดชำระ:</span> {formatThaiDate(invoice.dueDate)}</div>
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
                <td className="num">{formatNumber(l.unitPrice)}</td>
                <td className="num">{formatNumber(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ari-totals">
        <table>
          <tbody>
            <tr>
              <td>มูลค่าก่อนภาษี</td>
              <td className="num">{formatNumber(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td>ภาษีมูลค่าเพิ่ม 7%</td>
              <td className="num">{formatNumber(invoice.vatAmount)}</td>
            </tr>
            <tr className="ari-grand">
              <td>จำนวนเงินรวมทั้งสิ้น</td>
              <td className="num">{formatNumber(invoice.totalAmount)}</td>
            </tr>
            {Number(invoice.paidAmount) > 0 && (
              <>
                <tr>
                  <td>ชำระแล้ว</td>
                  <td className="num">{formatNumber(invoice.paidAmount)}</td>
                </tr>
                <tr>
                  <td>ยอดคงค้าง</td>
                  <td className="num">{formatNumber(outstanding)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {invoice.description && <div className="ari-notes">หมายเหตุ: {invoice.description}</div>}

      <div className="ari-sign">
        <div>
          <div className="ari-sign-line">ผู้รับสินค้า / Received by</div>
        </div>
        <div>
          <div className="ari-sign-line">ผู้ออกเอกสาร / Issued by</div>
        </div>
        <div>
          <div className="ari-sign-line">ผู้มีอำนาจลงนาม / Authorized</div>
        </div>
      </div>
    </div>
  );
}
