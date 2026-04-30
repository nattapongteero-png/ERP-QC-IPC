'use client';

/**
 * CoaPreview — client-side wrapper that renders the same CoaDocumentPdf
 * layout for an in-browser preview. Suitable for the COA detail page.
 *
 * This is a thin wrapper — the actual layout lives in CoaDocumentPdf.tsx
 * which is intentionally pure-render (no client-only React features), so it
 * works equally well on the server (PDF) and the client (preview).
 */

import { useEffect, useMemo, useState } from 'react';
import { CoaDocumentPdf } from './CoaDocumentPdf';
import type { CoaDocumentFull } from '@/lib/services/coa.service';
import type { CoaLanguage } from '@/lib/validation/coa';

interface CoaPreviewProps {
  coa: CoaDocumentFull;
  watermark?: 'DRAFT' | 'PREVIEW' | null;
  language?: CoaLanguage;
}

export function CoaPreview({ coa, watermark, language }: CoaPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const verifyUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/api/coa/verify/${encodeURIComponent(coa.qrCodeToken)}`;
  }, [coa.qrCodeToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!verifyUrl) return;
      try {
        const QRCode = await import('qrcode');
        const url = await QRCode.toDataURL(verifyUrl, {
          errorCorrectionLevel: 'M',
          width: 256,
          margin: 1,
        });
        if (!cancelled) setQrDataUrl(url);
      } catch (err) {
        console.error('[CoaPreview] QR generation failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  return (
    <div
      className="coa-preview-container"
      style={{
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        borderRadius: '4px',
        overflow: 'auto',
      }}
    >
      <CoaDocumentPdf
        coa={coa}
        watermark={watermark}
        language={language}
        qrDataUrl={qrDataUrl}
        verifyUrl={verifyUrl}
      />
    </div>
  );
}
