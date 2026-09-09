'use client';

/**
 * GmpDocumentPreviewDialog — in-page popup that previews a controlled GMP
 * document (PDF / Word / Excel) via the existing DocumentViewer, fed by the
 * version download route with ?inline=1.
 */
import { useEffect, useState } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Loader2, AlertCircle } from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';

interface GmpDocumentPreviewDialogProps {
  documentId: number | null;
  visible: boolean;
  onClose: () => void;
}

interface PreviewInfo {
  title: string;
  documentNumber: string;
  versionId: number;
  fileName: string;
}

export function GmpDocumentPreviewDialog({ documentId, visible, onClose }: GmpDocumentPreviewDialogProps) {
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || documentId == null) {
      setInfo(null);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        const d = body?.data ?? body;
        const cv = d?.currentVersion ?? (Array.isArray(d?.versions) ? d.versions[0] : null);
        if (!d || !cv?.id || !cv?.fileName) {
          setError('เอกสารนี้ยังไม่มีไฟล์แนบให้แสดง');
          setInfo(null);
          return;
        }
        setInfo({
          title: d.title ?? '',
          documentNumber: d.documentNumber ?? '',
          versionId: Number(cv.id),
          fileName: String(cv.fileName),
        });
      })
      .catch(() => alive && setError('โหลดเอกสารไม่สำเร็จ'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, documentId]);

  return (
    <>
      <style>{`
        .doc-preview-popup .dx-overlay-content { border-radius: 24px; }
        .doc-preview-popup .dx-popup-title { border-bottom-color: #f1f3f5 !important; }
        .doc-preview-popup .dx-overlay-content:focus,
        .doc-preview-popup .dx-overlay-content:focus-visible,
        .doc-preview-popup .dx-overlay-content.dx-state-focused {
          outline: none !important;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28) !important;
        }
      `}</style>
    <Popup
      wrapperAttr={{ class: 'doc-preview-popup' }}
      visible={visible}
      onHiding={onClose}
      showCloseButton
      title={info ? `${info.documentNumber} — ${info.title}` : 'ดูเอกสาร'}
      width="min(920px, 92vw)"
      height="85vh"
    >
      <div className="-m-6 flex h-[calc(100%+3rem)] flex-col overflow-hidden bg-[#f5f6f8] p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-[13px] text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลดเอกสาร…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[#b45309]">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {!loading && !error && info && (
          <div className="h-full overflow-hidden rounded-[16px] bg-white">
            <DocumentViewer
              fileUrl={`/api/documents/versions/${info.versionId}/download?inline=1`}
              fileName={info.fileName}
              className="h-full"
            />
          </div>
        )}
      </div>
    </Popup>
    </>
  );
}

export default GmpDocumentPreviewDialog;
