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
    <Popup
      visible={visible}
      onHiding={onClose}
      showCloseButton
      title={info ? `${info.documentNumber} — ${info.title}` : 'ดูเอกสาร'}
      width="80vw"
      height="85vh"
    >
      <div className="h-full overflow-auto p-1">
        {loading && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลดเอกสาร…
          </div>
        )}
        {error && (
          <div className="h-full flex items-center justify-center text-amber-700">
            <AlertCircle className="w-5 h-5 mr-2" /> {error}
          </div>
        )}
        {!loading && !error && info && (
          <DocumentViewer
            fileUrl={`/api/documents/versions/${info.versionId}/download?inline=1`}
            fileName={info.fileName}
            className="h-full"
          />
        )}
      </div>
    </Popup>
  );
}

export default GmpDocumentPreviewDialog;
