/**
 * Delivery Note Printable Document (ใบส่งของ)
 *
 * Hidden on screen (`.print-only`) and revealed by the browser print flow via
 * the global `@media print` rules in globals.css — same mechanism as the sales
 * order and PR documents.
 *
 * Deliberately NOT a money document: no prices, no VAT, no totals. A delivery
 * note travels with the goods and proves WHAT was handed over — the lot number
 * and its expiry are the columns that matter, because that is what the customer
 * checks on arrival and what a recall traces back through. Prices belong on the
 * invoice.
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

export interface DeliveryNotePrintLine {
  itemCode?: string | null;
  itemName?: string | null;
  lotNumber: string;
  /** From the lot. Printed so the customer can check it on arrival. */
  expiryDate?: string | null;
  quantity: number;
  unit: string;
}

export interface DeliveryNotePrintData {
  deliveryNumber: string;
  deliveryDate?: string | null;
  soNumber?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  customerContact?: string | null;
  status?: string | null;
  notes?: string | null;
  lines: DeliveryNotePrintLine[];
}

const STATUS_LABELS: Record<string, string> = {
  shipped: 'จัดส่งแล้ว',
  delivered: 'ส่งมอบแล้ว',
  returned: 'ตีกลับ',
};

/** Days from today until `date`; null when there is no usable date. */
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const due = new Date(date);
  if (isNaN(due.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DeliveryNotePrintDocument({ note }: { note: DeliveryNotePrintData }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/company')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.success) setCompany(json.data);
      })
      .catch(() => {
        // A missing company block must not stop the note printing — the goods
        // still have to leave with paperwork.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalQty = note.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  return (
    <div className="print-only print-doc dn-print-doc" data-testid="dn-print-document">
      <style jsx>{`
        .dn-print-doc {
          font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
          color: #000;
          padding: 16mm;
          font-size: 12pt;
        }
        .dn-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .dn-title { font-size: 20pt; font-weight: 700; text-align: right; }
        .dn-meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; }
        .dn-block { flex: 1; }
        .dn-label { font-size: 10pt; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11pt; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: 700; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .dn-expired { font-weight: 700; }
        .dn-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
        .dn-sign div { flex: 1; text-align: center; }
        .dn-sign-line { border-top: 1px solid #000; margin-top: 44px; padding-top: 6px; font-size: 10pt; }
        .dn-notes { margin-top: 12px; font-size: 10pt; }
      `}</style>

      <div className="dn-head">
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
          {company?.taxId && <div style={{ fontSize: '10pt' }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>}
        </div>
        <div className="dn-title">
          ใบส่งของ
          <div style={{ fontSize: '10pt', fontWeight: 400 }}>Delivery Note</div>
        </div>
      </div>

      <div className="dn-meta">
        <div className="dn-block">
          <div className="dn-label">ลูกค้า / Customer</div>
          <div style={{ fontWeight: 700 }}>{note.customerName || '-'}</div>
          {note.customerAddress && <div style={{ fontSize: '10pt' }}>{note.customerAddress}</div>}
          {note.customerContact && <div style={{ fontSize: '10pt' }}>ผู้ติดต่อ: {note.customerContact}</div>}
        </div>
        <div className="dn-block" style={{ maxWidth: '46%' }}>
          <div><span className="dn-label">เลขที่ใบส่งของ:</span> <b>{note.deliveryNumber}</b></div>
          <div><span className="dn-label">วันที่ส่ง:</span> {formatThaiDate(note.deliveryDate)}</div>
          {note.soNumber && <div><span className="dn-label">อ้างอิงใบสั่งขาย:</span> {note.soNumber}</div>}
          {note.status && (
            <div><span className="dn-label">สถานะ:</span> {STATUS_LABELS[note.status] ?? note.status}</div>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '14%' }}>รหัสสินค้า</th>
            <th>ชื่อสินค้า</th>
            <th style={{ width: '18%' }}>เลข Lot</th>
            <th style={{ width: '15%' }}>วันหมดอายุ</th>
            <th className="num" style={{ width: '14%' }}>จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {note.lines.map((l, i) => {
            const days = daysUntil(l.expiryDate);
            return (
              <tr key={`${l.lotNumber}-${i}`}>
                <td className="num">{i + 1}</td>
                <td>{l.itemCode || '-'}</td>
                <td>{l.itemName || '-'}</td>
                <td>{l.lotNumber}</td>
                {/* The customer checks this on arrival; an expired lot must be
                    visible on the paper, not only on our screen. */}
                <td className={days !== null && days < 0 ? 'dn-expired' : undefined}>
                  {formatThaiDate(l.expiryDate)}
                  {days !== null && days < 0 && ' (หมดอายุ)'}
                </td>
                <td className="num">
                  {formatNumber(l.quantity)} {l.unit}
                </td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>รวมจำนวน</td>
            <td className="num" style={{ fontWeight: 700 }}>{formatNumber(totalQty)}</td>
          </tr>
        </tbody>
      </table>

      {note.notes && <div className="dn-notes">หมายเหตุ: {note.notes}</div>}

      <div className="dn-sign">
        <div>
          <div className="dn-sign-line">ผู้ส่งสินค้า / Delivered by</div>
        </div>
        <div>
          <div className="dn-sign-line">ผู้รับสินค้า / Received by</div>
        </div>
        <div>
          <div className="dn-sign-line">วันที่รับ / Date</div>
        </div>
      </div>
    </div>
  );
}
