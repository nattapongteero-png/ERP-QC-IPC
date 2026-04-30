/**
 * CoaDocumentPdf — server-rendered React component for the official PDF.
 *
 * Used by `src/lib/coa/pdf-renderer.ts` which calls `renderToString` to
 * produce HTML, then Puppeteer renders that to PDF. Same component is
 * also imported by `CoaPreview.tsx` for browser preview.
 *
 * Layout follows qc-coa-design.md §4.3 / WHO TRS 1010 Annex 4.
 *
 * NOTE: Avoid client-only React features here (no useState/useEffect).
 *       This file is intentionally pure-render so it can be used server-side.
 *
 * Template HTML rendering: header_html and footer_html (admin-managed text)
 * are rendered as PRE-formatted text (escaped) — not via innerHTML — to
 * avoid an XSS surface. If admins need rich layout, they can use line
 * breaks; the field is documented as "plain text + line breaks only".
 */

import * as React from 'react';
import type { CoaDocumentFull } from '@/lib/services/coa.service';
import type { CoaLanguage } from '@/lib/validation/coa';

interface CoaDocumentPdfProps {
  coa: CoaDocumentFull;
  watermark?: 'DRAFT' | 'PREVIEW' | null;
  language?: CoaLanguage;
  /** Pre-generated QR code data URL (data:image/png;base64,...). */
  qrDataUrl?: string;
  /** Public verify URL — printed under the QR. */
  verifyUrl?: string;
  /** Optional company info from template — overrides design-time defaults. */
  companyInfo?: {
    name?: string;
    address?: string;
    licenseNo?: string;
  };
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(value);
  }
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
  } catch {
    return String(value);
  }
}

function bilingualLabel(en: string, th: string, language?: CoaLanguage): string {
  if (language === 'th') return th;
  if (language === 'en') return en;
  return `${en} / ${th}`;
}

function conclusionLabel(c: string): { en: string; th: string; positive: boolean } {
  if (c === 'complies') {
    return { en: 'COMPLIES with specifications', th: 'เป็นไปตามข้อกำหนดทุกประการ', positive: true };
  }
  if (c === 'does_not_comply') {
    return { en: 'DOES NOT COMPLY with specifications', th: 'ไม่เป็นไปตามข้อกำหนด', positive: false };
  }
  return { en: 'PARTIAL — incomplete results', th: 'ผลทดสอบไม่สมบูรณ์', positive: false };
}

function testStatusBadge(c: string): { label: string; bg: string; color: string } {
  if (c === 'conform') {
    return { label: '✓ Pass', bg: '#d1fae5', color: '#065f46' };
  }
  if (c === 'non_conform') {
    return { label: '✗ Fail', bg: '#fee2e2', color: '#991b1b' };
  }
  return { label: 'N/A', bg: '#f3f4f6', color: '#374151' };
}

/** Render admin template text as line-broken paragraphs — no HTML injection. */
function TemplateText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const lines = String(text).split(/\r?\n/);
  return (
    <>
      {lines.map((line, idx) => (
        <div key={idx} style={{ minHeight: line ? undefined : '0.6em' }}>
          {line}
        </div>
      ))}
    </>
  );
}

export function CoaDocumentPdf({
  coa,
  watermark,
  language = 'bilingual',
  qrDataUrl,
  verifyUrl,
  companyInfo,
}: CoaDocumentPdfProps) {
  const conclusion = conclusionLabel(coa.conclusion);
  const tplLanguage = (coa.template?.language as CoaLanguage) || language;
  const showStorage = coa.template?.showStorageConditions ?? true;
  const showExpiry = coa.template?.showExpiryDate ?? true;
  const showRetest = coa.template?.showRetestDate ?? false;
  const showQr = coa.template?.showQrVerify ?? true;

  const company = {
    name: companyInfo?.name ?? 'Herbal Medicine ERP',
    address: companyInfo?.address ?? '',
    licenseNo: companyInfo?.licenseNo ?? '',
  };

  // Find signatures by role for the 3-column approval table
  const sigByRole = new Map<string, typeof coa.signatures[number]>();
  for (const s of coa.signatures) sigByRole.set(s.role, s);
  const analystSig = sigByRole.get('analyst');
  const reviewerSig = sigByRole.get('qc_manager') ?? sigByRole.get('approver');
  const approverSig = sigByRole.get('qa_release') ?? sigByRole.get('approver');

  const productNameDisplay = (() => {
    const th = coa.productName ?? '';
    const en = coa.productNameEn ?? '';
    if (tplLanguage === 'th') return th || en;
    if (tplLanguage === 'en') return en || th;
    return th && en ? `${th} / ${en}` : th || en || '—';
  })();

  return (
    <div
      className="coa-document"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '210mm',
        margin: '0 auto',
        padding: '8mm',
        fontFamily: '"Sarabun", "Noto Sans Thai", sans-serif',
        fontSize: '10.5pt',
        color: '#111827',
        lineHeight: 1.4,
      }}
    >
      {watermark ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: '120pt',
            fontWeight: 800,
            color: 'rgba(220, 38, 38, 0.12)',
            zIndex: 0,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {watermark}
        </div>
      ) : null}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          paddingBottom: '12px',
          borderBottom: '2px solid #065f46',
        }}
      >
        {coa.template?.headerLogoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coa.template.headerLogoPath}
            alt="Company logo"
            style={{ width: '70px', height: '70px', objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '8px',
              background: '#065f46',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24pt',
              fontWeight: 700,
            }}
          >
            ✓
          </div>
        )}
        <div style={{ flex: 1, fontSize: '10pt', color: '#374151' }}>
          {coa.template?.headerHtml ? (
            <TemplateText text={coa.template.headerHtml} />
          ) : (
            <>
              <div style={{ fontSize: '14pt', fontWeight: 700, color: '#065f46' }}>
                {company.name}
              </div>
              {company.address ? (
                <div style={{ fontSize: '9pt', color: '#6b7280' }}>{company.address}</div>
              ) : null}
              {company.licenseNo ? (
                <div style={{ fontSize: '9pt', color: '#6b7280' }}>
                  License No.: {company.licenseNo}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Title block */}
      <div style={{ textAlign: 'center', marginTop: '14px', marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '18pt',
            fontWeight: 800,
            letterSpacing: '0.03em',
            color: '#065f46',
          }}
        >
          CERTIFICATE OF ANALYSIS
        </div>
        <div style={{ fontSize: '13pt', color: '#374151', marginTop: '2px' }}>
          ใบรับรองคุณภาพ
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '10px',
            fontSize: '10pt',
            color: '#374151',
          }}
        >
          <div>
            <strong>COA No.:</strong> {coa.coaNumber}
          </div>
          <div>
            <strong>{bilingualLabel('Issue Date', 'วันที่ออก', tplLanguage)}:</strong>{' '}
            {formatDate(coa.issueDate)}
          </div>
        </div>
      </div>

      {/* Product information block */}
      <SectionTitle
        title={bilingualLabel('PRODUCT INFORMATION', 'ข้อมูลสินค้า', tplLanguage)}
      />
      <table style={tableStyle}>
        <tbody>
          <Row
            label={bilingualLabel('Product Name', 'ชื่อผลิตภัณฑ์', tplLanguage)}
            value={productNameDisplay}
          />
          <Row
            label={bilingualLabel('Product Code', 'รหัสสินค้า', tplLanguage)}
            value={coa.productCode ?? '—'}
          />
          <Row
            label={bilingualLabel('Lot / Batch No.', 'หมายเลขล็อต', tplLanguage)}
            value={coa.lotNumber || '—'}
          />
          <Row
            label={bilingualLabel('Manufacture Date', 'วันที่ผลิต', tplLanguage)}
            value={formatDate(coa.manufactureDate)}
          />
          {showExpiry ? (
            <Row
              label={bilingualLabel('Expiry Date', 'วันหมดอายุ', tplLanguage)}
              value={formatDate(coa.expiryDate)}
            />
          ) : null}
          {showRetest ? (
            <Row
              label={bilingualLabel('Retest Date', 'วันที่ทดสอบใหม่', tplLanguage)}
              value={formatDate(coa.retestDate)}
            />
          ) : null}
          {showStorage && coa.storageConditions ? (
            <Row
              label={bilingualLabel('Storage Conditions', 'สภาพการเก็บรักษา', tplLanguage)}
              value={coa.storageConditions}
            />
          ) : null}
          {coa.quantityReceived != null ? (
            <Row
              label={bilingualLabel('Quantity', 'ปริมาณ', tplLanguage)}
              value={`${coa.quantityReceived} ${coa.unit ?? ''}`}
            />
          ) : null}
          {coa.customerName ? (
            <Row
              label={bilingualLabel('Customer / PO', 'ลูกค้า / PO', tplLanguage)}
              value={`${coa.customerName}${coa.salesOrderRef ? ` / ${coa.salesOrderRef}` : ''}`}
            />
          ) : null}
        </tbody>
      </table>

      {/* Test results */}
      <SectionTitle
        title={bilingualLabel('TEST RESULTS', 'ผลการทดสอบ', tplLanguage)}
      />
      <table style={{ ...tableStyle, fontSize: '9.5pt' }}>
        <thead>
          <tr style={{ background: '#065f46', color: '#fff' }}>
            <th style={{ ...thStyle, width: '6%' }}>#</th>
            <th style={{ ...thStyle, width: '28%' }}>
              {bilingualLabel('Test', 'รายการทดสอบ', tplLanguage)}
            </th>
            <th style={{ ...thStyle, width: '15%' }}>
              {bilingualLabel('Method', 'วิธีการ', tplLanguage)}
            </th>
            <th style={{ ...thStyle, width: '21%' }}>
              {bilingualLabel('Specification', 'ข้อกำหนด', tplLanguage)}
            </th>
            <th style={{ ...thStyle, width: '17%' }}>
              {bilingualLabel('Result', 'ผลทดสอบ', tplLanguage)}
            </th>
            <th style={{ ...thStyle, width: '13%', textAlign: 'center' }}>
              {bilingualLabel('Status', 'สถานะ', tplLanguage)}
            </th>
          </tr>
        </thead>
        <tbody>
          {coa.results.map((r, idx) => {
            const badge = testStatusBadge(r.conclusion);
            const display = r.testNameTh && r.testName !== r.testNameTh
              ? `${r.testName} / ${r.testNameTh}`
              : r.testName;
            return (
              <tr key={r.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={tdStyle}>{r.sequence}</td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{display}</td>
                <td style={tdStyle}>{r.testMethod || '—'}</td>
                <td style={tdStyle}>{r.specification}</td>
                <td style={tdStyle}>
                  {r.result}
                  {r.resultUnit ? ` ${r.resultUnit}` : ''}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 600,
                      fontSize: '8.5pt',
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Conclusion banner */}
      <SectionTitle title={bilingualLabel('CONCLUSION', 'สรุปผล', tplLanguage)} />
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '6px',
          border: '2px solid',
          borderColor: conclusion.positive ? '#10b981' : '#ef4444',
          background: conclusion.positive ? '#ecfdf5' : '#fef2f2',
          textAlign: 'center',
          fontSize: '11pt',
          fontWeight: 600,
          color: conclusion.positive ? '#065f46' : '#991b1b',
        }}
      >
        <div>{conclusion.positive ? '✓' : '✗'} {conclusion.en}</div>
        <div style={{ fontSize: '10pt', marginTop: '2px' }}>{conclusion.th}</div>
      </div>

      {/* Approvals */}
      <SectionTitle title={bilingualLabel('APPROVALS', 'การลงนาม', tplLanguage)} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginTop: '6px',
        }}
      >
        <SignatureBlock
          title={bilingualLabel('Tested by', 'ผู้ทดสอบ', tplLanguage)}
          sig={analystSig}
          fallbackName={coa.createdByName}
        />
        <SignatureBlock
          title={bilingualLabel('Reviewed by', 'ผู้ตรวจสอบ', tplLanguage)}
          sig={reviewerSig}
        />
        <SignatureBlock
          title={bilingualLabel('Approved by', 'ผู้อนุมัติ', tplLanguage)}
          sig={approverSig}
        />
      </div>

      {/* Footer + QR */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '10px',
          borderTop: '1px solid #d1d5db',
          fontSize: '8.5pt',
          color: '#6b7280',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {showQr && qrDataUrl ? (
            <div style={{ textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Verify QR" width={90} height={90} />
              <div style={{ fontSize: '7pt', marginTop: '2px' }}>
                {bilingualLabel('Scan to verify', 'สแกนเพื่อตรวจสอบ', tplLanguage)}
              </div>
            </div>
          ) : null}
          <div style={{ flex: 1 }}>
            {coa.template?.footerHtml ? (
              <TemplateText text={coa.template.footerHtml} />
            ) : (
              <>
                <div>
                  References: USP, Ph.Eur, Thai Herbal Pharmacopoeia
                </div>
                <div style={{ marginTop: '2px' }}>
                  This certificate is computer-generated. Audit trail available
                  on request. ใบรับรองนี้ผลิตด้วยระบบคอมพิวเตอร์ — ตรวจสอบประวัติได้ตามคำขอ
                </div>
              </>
            )}
            {showQr && verifyUrl ? (
              <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                Verify: {verifyUrl}
              </div>
            ) : null}
            <div style={{ marginTop: '6px', textAlign: 'center', fontWeight: 600 }}>
              ─── {bilingualLabel('End of Certificate', 'สิ้นสุดใบรับรอง', tplLanguage)} ───
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '4px',
};

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '9.5pt',
  border: '1px solid #065f46',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #d1d5db',
  verticalAlign: 'top',
};

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        marginTop: '12px',
        marginBottom: '4px',
        fontSize: '10.5pt',
        fontWeight: 700,
        color: '#065f46',
        letterSpacing: '0.02em',
      }}
    >
      {title}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <tr>
      <td
        style={{
          ...tdStyle,
          width: '38%',
          fontWeight: 600,
          background: '#f9fafb',
        }}
      >
        {label}
      </td>
      <td style={tdStyle}>{value ?? '—'}</td>
    </tr>
  );
}

function SignatureBlock({
  title,
  sig,
  fallbackName,
}: {
  title: string;
  sig?: {
    userNameSnapshot: string | null;
    userTitleSnapshot: string | null;
    signedAt: string | Date;
    signatureMeaning: string | null;
    signatureImagePath: string | null;
  };
  fallbackName?: string | null;
}) {
  return (
    <div
      style={{
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        padding: '8px',
        minHeight: '90px',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          fontSize: '8.5pt',
          fontWeight: 600,
          color: '#6b7280',
          marginBottom: '4px',
        }}
      >
        {title}
      </div>
      {sig?.signatureImagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sig.signatureImagePath}
          alt={`${title} signature`}
          style={{ height: '32px', objectFit: 'contain' }}
        />
      ) : (
        <div style={{ height: '32px', borderBottom: '1px dashed #9ca3af', marginBottom: '4px' }} />
      )}
      <div style={{ fontSize: '9.5pt', fontWeight: 600 }}>
        {sig?.userNameSnapshot ?? fallbackName ?? '—'}
      </div>
      <div style={{ fontSize: '8.5pt', color: '#6b7280' }}>
        {sig?.userTitleSnapshot ?? ''}
      </div>
      <div style={{ fontSize: '8pt', color: '#9ca3af', marginTop: '2px' }}>
        {sig?.signedAt ? formatDateTime(sig.signedAt) : '—'}
      </div>
    </div>
  );
}
