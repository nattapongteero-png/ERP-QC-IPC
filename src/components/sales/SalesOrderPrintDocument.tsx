/**
 * Sales Order Printable Document
 *
 * Renders a standard A4 Thai sales document (ใบสั่งขาย / ใบส่งสินค้า) for
 * printing. Hidden on screen (`.print-only`) and revealed only by the
 * browser print flow via the global `@media print` rules in globals.css.
 *
 * Layout follows a conventional Thai sales/delivery form: company (seller)
 * header, customer (buyer) block, document meta, line-item table, a totals
 * block with VAT 7%, and a signature block. Mirrors the PR print document.
 */

'use client';

import { useEffect, useState } from 'react';

interface CompanyInfo {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

export interface SalesOrderPrintLine {
  itemCode?: string | null;
  itemName: string;
  itemUnit?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal?: number | null;
}

export interface SalesOrderPrintData {
  soNumber: string;
  customerName?: string | null;
  customerContact?: string | null;
  customerAddress?: string | null;
  orderDate?: string | null;
  requiredDate?: string | null;
  status?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  /** Freight charged to the customer — shown as its own line and added to the
   *  grand total (list item 24). */
  shippingCost?: number | null;
  lines: SalesOrderPrintLine[];
}

interface SalesOrderPrintDocumentProps {
  order: SalesOrderPrintData;
  /** VAT rate applied to the subtotal. Defaults to Thailand's 7%. */
  vatRate?: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง (Draft)',
  confirmed: 'ยืนยันแล้ว (Confirmed)',
  processing: 'กำลังดำเนินการ (Processing)',
  partially_shipped: 'ส่งบางส่วน (Partially Shipped)',
  shipped: 'ส่งแล้ว (Shipped)',
  completed: 'เสร็จสมบูรณ์ (Completed)',
  cancelled: 'ยกเลิก (Cancelled)',
};

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatMoney(n: number): string {
  return (n || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Convert a number to Thai baht text (e.g. 1234.50 -> "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์").
function bahtText(amount: number): string {
  const num = Math.abs(amount);
  const baht = Math.floor(num);
  const satang = Math.round((num - baht) * 100);
  const thaiDigits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const thaiPlaces = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const readGroup = (n: number): string => {
    let s = '';
    const digits = String(n).split('').map(Number);
    const len = digits.length;
    for (let i = 0; i < len; i++) {
      const digit = digits[i];
      const place = len - i - 1;
      if (digit === 0) continue;
      if (place === 0 && digit === 1 && len > 1) {
        s += 'เอ็ด';
      } else if (place === 1 && digit === 2) {
        s += 'ยี่' + thaiPlaces[place];
      } else if (place === 1 && digit === 1) {
        s += thaiPlaces[place];
      } else {
        s += thaiDigits[digit] + thaiPlaces[place];
      }
    }
    return s;
  };

  const readNumber = (n: number): string => {
    if (n === 0) return 'ศูนย์';
    let result = '';
    const millions = Math.floor(n / 1_000_000);
    const remainder = n % 1_000_000;
    if (millions > 0) result += readNumber(millions) + 'ล้าน';
    if (remainder > 0) result += readGroup(remainder);
    return result;
  };

  let text = readNumber(baht) + 'บาท';
  if (satang > 0) {
    text += readGroup(satang) + 'สตางค์';
  } else {
    text += 'ถ้วน';
  }
  return text;
}

export function SalesOrderPrintDocument({ order, vatRate = 0.07 }: SalesOrderPrintDocumentProps) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/settings/company')
      .then((r) => r.json())
      .then((result) => {
        if (active && result.success) setCompany(result.data);
      })
      .catch(() => {
        /* header falls back to defaults if settings unavailable */
      });
    return () => {
      active = false;
    };
  }, []);

  const companyTitle =
    company?.companyNameTh || company?.companyName || 'บริษัท สมุนไพรไทย จำกัด';

  const subtotal = order.lines.reduce(
    (sum, l) =>
      sum +
      (l.lineTotal != null
        ? Number(l.lineTotal)
        : (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)),
    0,
  );
  const vat = subtotal * vatRate;
  const freight = Number(order.shippingCost) || 0;
  const grandTotal = subtotal + vat + freight;

  return (
    <div className="print-only so-print-doc" data-testid="so-print-document">
      {/* ===== Header: company (seller) + document title ===== */}
      <div className="so-print-header">
        <div className="so-print-company">
          <div className="so-print-company-name">{companyTitle}</div>
          {company?.companyName && company?.companyNameTh && (
            <div className="so-print-company-sub">{company.companyName}</div>
          )}
          {company?.address && (
            <div className="so-print-company-line">{company.address}</div>
          )}
          <div className="so-print-company-line">
            {company?.phone && <span>โทร: {company.phone}</span>}
            {company?.phone && company?.email && <span> | </span>}
            {company?.email && <span>อีเมล: {company.email}</span>}
          </div>
          {company?.taxId && (
            <div className="so-print-company-line">
              เลขประจำตัวผู้เสียภาษี: {company.taxId}
            </div>
          )}
        </div>
        <div className="so-print-title-box">
          <div className="so-print-title">ใบสั่งขาย / ใบส่งสินค้า</div>
          <div className="so-print-title-en">SALES ORDER / DELIVERY NOTE</div>
        </div>
      </div>

      {/* ===== Customer (buyer) + document meta ===== */}
      <div className="so-print-parties">
        <table className="so-print-customer">
          <tbody>
            <tr>
              <td className="so-party-label">ลูกค้า / Customer</td>
              <td className="so-party-value">{order.customerName || '-'}</td>
            </tr>
            <tr>
              <td className="so-party-label">ผู้ติดต่อ / Contact</td>
              <td className="so-party-value">{order.customerContact || '-'}</td>
            </tr>
            <tr>
              <td className="so-party-label">ที่อยู่ / Address</td>
              <td className="so-party-value">{order.customerAddress || '-'}</td>
            </tr>
          </tbody>
        </table>

        <table className="so-print-meta">
          <tbody>
            <tr>
              <td className="so-meta-label">เลขที่ / No.</td>
              <td className="so-meta-value">{order.soNumber}</td>
            </tr>
            <tr>
              <td className="so-meta-label">วันที่ / Date</td>
              <td className="so-meta-value">{formatThaiDate(order.orderDate)}</td>
            </tr>
            <tr>
              <td className="so-meta-label">กำหนดส่ง / Due</td>
              <td className="so-meta-value">{formatThaiDate(order.requiredDate)}</td>
            </tr>
            <tr>
              <td className="so-meta-label">เงื่อนไขชำระ / Terms</td>
              <td className="so-meta-value">{order.paymentTerms || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== Line items ===== */}
      <table className="so-print-lines">
        <thead>
          <tr>
            <th className="so-col-no">ลำดับ</th>
            <th className="so-col-code">รหัสสินค้า</th>
            <th className="so-col-desc">รายการ / Description</th>
            <th className="so-col-qty">จำนวน</th>
            <th className="so-col-unit">หน่วย</th>
            <th className="so-col-price">ราคา/หน่วย</th>
            <th className="so-col-amount">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, idx) => {
            const amount =
              line.lineTotal != null
                ? Number(line.lineTotal)
                : (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
            return (
              <tr key={idx}>
                <td className="so-col-no">{idx + 1}</td>
                <td className="so-col-code">{line.itemCode || '-'}</td>
                <td className="so-col-desc">{line.itemName}</td>
                <td className="so-col-qty">
                  {(Number(line.quantity) || 0).toLocaleString('th-TH')}
                </td>
                <td className="so-col-unit">{line.itemUnit || '-'}</td>
                <td className="so-col-price">{formatMoney(Number(line.unitPrice) || 0)}</td>
                <td className="so-col-amount">{formatMoney(amount)}</td>
              </tr>
            );
          })}
          {/* Pad to a minimum number of rows so the form keeps a standard shape */}
          {Array.from({ length: Math.max(0, 8 - order.lines.length) }).map((_, i) => (
            <tr key={`pad-${i}`} className="so-pad-row">
              <td className="so-col-no">&nbsp;</td>
              <td className="so-col-code"></td>
              <td className="so-col-desc"></td>
              <td className="so-col-qty"></td>
              <td className="so-col-unit"></td>
              <td className="so-col-price"></td>
              <td className="so-col-amount"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Totals: subtotal + VAT + grand total ===== */}
      <div className="so-print-totals-wrap">
        <div className="so-print-bahttext">
          <span className="so-bahttext-label">จำนวนเงินรวมทั้งสิ้น (ตัวอักษร):</span>
          <span className="so-bahttext-value">({bahtText(grandTotal)})</span>
        </div>
        <table className="so-print-totals">
          <tbody>
            <tr>
              <td className="so-total-label">รวมเป็นเงิน / Subtotal</td>
              <td className="so-total-value">{formatMoney(subtotal)}</td>
            </tr>
            <tr>
              <td className="so-total-label">
                ภาษีมูลค่าเพิ่ม / VAT {(vatRate * 100).toFixed(0)}%
              </td>
              <td className="so-total-value">{formatMoney(vat)}</td>
            </tr>
            {freight > 0 && (
              <tr>
                <td className="so-total-label">ค่าขนส่ง / Freight</td>
                <td className="so-total-value">{formatMoney(freight)}</td>
              </tr>
            )}
            <tr className="so-total-grand">
              <td className="so-total-label">จำนวนเงินสุทธิ / Grand Total</td>
              <td className="so-total-value">{formatMoney(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {order.notes && (
        <div className="so-print-note">
          <strong>หมายเหตุ / Notes:</strong> {order.notes}
        </div>
      )}

      {/* ===== Signature block ===== */}
      <div className="so-print-signatures">
        <div className="so-sign-box">
          <div className="so-sign-line">&nbsp;</div>
          <div className="so-sign-role">ผู้สั่งซื้อ / Ordered by</div>
          <div className="so-sign-date">วันที่ / Date ............................</div>
        </div>
        <div className="so-sign-box">
          <div className="so-sign-line">&nbsp;</div>
          <div className="so-sign-role">ผู้ส่งสินค้า / Delivered by</div>
          <div className="so-sign-date">วันที่ / Date ............................</div>
        </div>
        <div className="so-sign-box">
          <div className="so-sign-line">&nbsp;</div>
          <div className="so-sign-role">ผู้รับสินค้า / Received by</div>
          <div className="so-sign-date">วันที่ / Date ............................</div>
        </div>
      </div>
    </div>
  );
}
