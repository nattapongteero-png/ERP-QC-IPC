/**
 * Purchase Requisition Printable Document
 *
 * Renders a standard A4 purchase-requisition form for printing.
 * Hidden on screen (`.print-only`) and revealed only by the browser
 * print flow via the global `@media print` rules in globals.css.
 *
 * Layout follows a conventional Thai PR form: company header, document
 * meta block, line-item table, totals, notes, and a signature block.
 */

'use client';

import { useEffect, useState } from 'react';
import type { PRWithLines } from '@/types/purchase-requisition';

interface CompanyInfo {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

interface PRPrintDocumentProps {
  pr: PRWithLines;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'ต่ำ (Low)',
  normal: 'ปกติ (Normal)',
  high: 'สูง (High)',
  urgent: 'เร่งด่วน (Urgent)',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง (Draft)',
  submitted: 'ส่งอนุมัติ (Submitted)',
  pending_approval: 'รออนุมัติ (Pending Approval)',
  approved: 'อนุมัติแล้ว (Approved)',
  rejected: 'ไม่อนุมัติ (Rejected)',
  cancelled: 'ยกเลิก (Cancelled)',
  converted: 'แปลงเป็น PO แล้ว (Converted)',
};

function formatThaiDate(value?: Date | string | null): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
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

export function PRPrintDocument({ pr }: PRPrintDocumentProps) {
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

  const totalAmount = pr.lines.reduce(
    (sum, l) =>
      sum + (Number(l.quantity) || 0) * (Number(l.estimatedUnitPrice) || 0),
    0,
  );

  return (
    <div className="print-only pr-print-doc" data-testid="pr-print-document">
      {/* ===== Header: company + document title ===== */}
      <div className="pr-print-header">
        <div className="pr-print-company">
          <div className="pr-print-company-name">{companyTitle}</div>
          {company?.companyName && company?.companyNameTh && (
            <div className="pr-print-company-sub">{company.companyName}</div>
          )}
          {company?.address && (
            <div className="pr-print-company-line">{company.address}</div>
          )}
          <div className="pr-print-company-line">
            {company?.phone && <span>โทร: {company.phone}</span>}
            {company?.phone && company?.email && <span> | </span>}
            {company?.email && <span>อีเมล: {company.email}</span>}
          </div>
          {company?.taxId && (
            <div className="pr-print-company-line">
              เลขประจำตัวผู้เสียภาษี: {company.taxId}
            </div>
          )}
        </div>
        <div className="pr-print-title-box">
          <div className="pr-print-title">ใบขอซื้อ</div>
          <div className="pr-print-title-en">PURCHASE REQUISITION</div>
        </div>
      </div>

      {/* ===== Document meta ===== */}
      <table className="pr-print-meta">
        <tbody>
          <tr>
            <td className="pr-meta-label">เลขที่ใบขอซื้อ / PR No.</td>
            <td className="pr-meta-value">{pr.prNumber}</td>
            <td className="pr-meta-label">วันที่ / Date</td>
            <td className="pr-meta-value">{formatThaiDate(pr.createdAt)}</td>
          </tr>
          <tr>
            <td className="pr-meta-label">ผู้ขอซื้อ / Requester</td>
            <td className="pr-meta-value">{pr.requesterName || '-'}</td>
            <td className="pr-meta-label">แผนก / Department</td>
            <td className="pr-meta-value">{pr.departmentName || '-'}</td>
          </tr>
          <tr>
            <td className="pr-meta-label">ความเร่งด่วน / Priority</td>
            <td className="pr-meta-value">
              {PRIORITY_LABELS[pr.priority] || pr.priority}
            </td>
            <td className="pr-meta-label">วันที่ต้องการ / Required Date</td>
            <td className="pr-meta-value">{formatThaiDate(pr.requiredDate)}</td>
          </tr>
          <tr>
            <td className="pr-meta-label">สถานะ / Status</td>
            <td className="pr-meta-value" colSpan={3}>
              {STATUS_LABELS[pr.status] || pr.status}
            </td>
          </tr>
        </tbody>
      </table>

      {pr.description && (
        <div className="pr-print-note">
          <strong>รายละเอียด / Description:</strong> {pr.description}
        </div>
      )}

      {/* ===== Line items ===== */}
      <table className="pr-print-lines">
        <thead>
          <tr>
            <th className="pr-col-no">ลำดับ</th>
            <th className="pr-col-code">รหัสสินค้า</th>
            <th className="pr-col-desc">รายการ / Description</th>
            <th className="pr-col-qty">จำนวน</th>
            <th className="pr-col-unit">หน่วย</th>
            <th className="pr-col-price">ราคา/หน่วย</th>
            <th className="pr-col-amount">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {pr.lines.map((line, idx) => {
            const amount =
              (Number(line.quantity) || 0) *
              (Number(line.estimatedUnitPrice) || 0);
            return (
              <tr key={line.id ?? idx}>
                <td className="pr-col-no">{idx + 1}</td>
                <td className="pr-col-code">{line.itemCode || '-'}</td>
                <td className="pr-col-desc">
                  {line.description}
                  {line.notes ? (
                    <div className="pr-line-notes">หมายเหตุ: {line.notes}</div>
                  ) : null}
                </td>
                <td className="pr-col-qty">
                  {(Number(line.quantity) || 0).toLocaleString('th-TH')}
                </td>
                <td className="pr-col-unit">{line.unitOfMeasure}</td>
                <td className="pr-col-price">
                  {formatMoney(Number(line.estimatedUnitPrice) || 0)}
                </td>
                <td className="pr-col-amount">{formatMoney(amount)}</td>
              </tr>
            );
          })}
          {/* Pad to a minimum number of rows so the form keeps a standard shape */}
          {Array.from({
            length: Math.max(0, 8 - pr.lines.length),
          }).map((_, i) => (
            <tr key={`pad-${i}`} className="pr-pad-row">
              <td className="pr-col-no">&nbsp;</td>
              <td className="pr-col-code"></td>
              <td className="pr-col-desc"></td>
              <td className="pr-col-qty"></td>
              <td className="pr-col-unit"></td>
              <td className="pr-col-price"></td>
              <td className="pr-col-amount"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pr-total-label" colSpan={6}>
              รวมเป็นเงินทั้งสิ้น / Total Amount (บาท)
            </td>
            <td className="pr-col-amount pr-total-value">
              {formatMoney(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {pr.justification && (
        <div className="pr-print-note">
          <strong>เหตุผล / Justification:</strong> {pr.justification}
        </div>
      )}

      {/* ===== Signature block ===== */}
      <div className="pr-print-signatures">
        <div className="pr-sign-box">
          <div className="pr-sign-line">&nbsp;</div>
          <div className="pr-sign-role">ผู้ขอซื้อ / Requested by</div>
          <div className="pr-sign-date">วันที่ / Date ............................</div>
        </div>
        <div className="pr-sign-box">
          <div className="pr-sign-line">&nbsp;</div>
          <div className="pr-sign-role">ผู้ตรวจสอบ / Checked by</div>
          <div className="pr-sign-date">วันที่ / Date ............................</div>
        </div>
        <div className="pr-sign-box">
          <div className="pr-sign-line">&nbsp;</div>
          <div className="pr-sign-role">ผู้อนุมัติ / Approved by</div>
          <div className="pr-sign-date">วันที่ / Date ............................</div>
        </div>
      </div>
    </div>
  );
}
