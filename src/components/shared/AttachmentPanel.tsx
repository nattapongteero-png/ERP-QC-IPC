'use client';
/**
 * Reusable file attachment panel.
 * Audit Q3 (packaging photos), Q4 (QC test reports), Q5 (QC inspection).
 *
 * Reads the existing /api/attachments endpoints + ATTACHMENT_CATEGORIES.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Upload, Trash2, Image as ImageIcon, FileText } from 'lucide-react';

export interface AttachmentPanelProps {
  /** Module name from VALID_MODULES, e.g. 'wo_packaging_integrity' */
  moduleName: string;
  /** Entity primary key (the row this attachment belongs to) */
  entityId: number;
  /** Pre-set category (optional). When set the dropdown is hidden. */
  defaultCategory?: string;
  /** Force only image MIME types in the file picker (used for packaging photo). */
  imagesOnly?: boolean;
  /** Override title — default "เอกสาร / รูปภาพแนบ" */
  title?: string;
  /** Disable upload/delete (view-only) */
  readOnly?: boolean;
  /** Optional data-testid base for tests */
  testIdBase?: string;
}

interface AttachmentRow {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string | null;
  description: string | null;
  uploadedAt: string;
  uploadedByName?: string | null;
}

const fmtBytes = (n: number) =>
  n < 1024 ? `${n}B` : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / (1024 * 1024)).toFixed(1)}MB`;

export function AttachmentPanel({
  moduleName,
  entityId,
  defaultCategory,
  imagesOnly = false,
  title = 'เอกสาร / รูปภาพแนบ',
  readOnly = false,
  testIdBase = 'attachments',
}: AttachmentPanelProps) {
  const toast = useToast();
  const [items, setItems] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attachments?moduleName=${moduleName}&entityId=${entityId}`,
      );
      const json = await res.json();
      setItems(json?.data || json || []);
    } finally {
      setLoading(false);
    }
  }, [moduleName, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFileSelected = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกิน 10MB');
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 the way the existing API expects (header stripped).
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = reader.result as string;
          resolve(s.includes(',') ? s.split(',')[1]! : s);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleName,
          entityId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          fileData,
          category: defaultCategory,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error('อัปโหลดไม่สำเร็จ', j?.error);
        return;
      }
      toast.success('อัปโหลดเรียบร้อย');
      void load();
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async (id: number) => {
    if (!confirm('ลบไฟล์นี้?')) return;
    const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('ลบไม่สำเร็จ');
      return;
    }
    toast.success('ลบไฟล์แล้ว');
    void load();
  };

  const accept = imagesOnly
    ? 'image/png,image/jpeg,image/webp,image/gif'
    : '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv';

  return (
    <div className="border rounded-lg bg-white" data-testid={`${testIdBase}-panel`}>
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-gray-500">({items.length})</span>
        </div>
        {!readOnly && (
          <>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept={accept}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFileSelected(f);
              }}
              data-testid={`${testIdBase}-input`}
            />
            <button
              className="text-sm bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              data-testid={`${testIdBase}-upload`}
            >
              <Upload className="w-3 h-3" /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 text-sm py-4">โหลด...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-4">ยังไม่มีไฟล์แนบ</div>
      ) : (
        <ul className="divide-y">
          {items.map((it) => {
            const isImage = it.mimeType?.startsWith('image/');
            return (
              <li
                key={it.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50"
                data-testid={`${testIdBase}-item-${it.id}`}
              >
                <a
                  href={`/api/attachments/${it.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-700 hover:underline truncate"
                >
                  {isImage ? (
                    <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="truncate">{it.fileName}</span>
                  <span className="text-xs text-gray-500">{fmtBytes(it.fileSize)}</span>
                </a>
                {!readOnly && (
                  <button
                    onClick={() => void remove(it.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    aria-label="ลบ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
