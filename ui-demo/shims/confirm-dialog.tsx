import * as React from 'react';

/**
 * Demo stand-in for ConfirmDialog (the real one is a DevExtreme Popup).
 * Same props and the same data-testids, so anything driving the dialog — the
 * stage-change confirmation — behaves identically.
 */
export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  testIdPrefix?: string;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  testIdPrefix = 'confirm-dialog',
}: ConfirmDialogProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        data-testid={`${testIdPrefix}-dialog`}
        className="w-full max-w-md rounded-[16px] bg-white p-6 shadow-xl"
      >
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p
          data-testid={`${testIdPrefix}-message`}
          className="mt-3 text-sm leading-relaxed text-slate-600"
          dangerouslySetInnerHTML={{ __html: message }}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            data-testid={`${testIdPrefix}-cancel-btn`}
            onClick={onCancel}
            className="rounded-[10px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-confirm-btn`}
            onClick={onConfirm}
            className="rounded-[10px] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Same hook contract as the app's. */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    testIdPrefix?: string;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (message: string, title = 'ยืนยัน', testIdPrefix?: string) =>
    new Promise<boolean>((resolve) => {
      setDialogState({
        visible: true,
        title,
        message,
        testIdPrefix,
        onConfirm: () => {
          setDialogState((s) => ({ ...s, visible: false }));
          resolve(true);
        },
      });
      (window as unknown as { __resolveConfirm?: (v: boolean) => void }).__resolveConfirm = resolve;
    });

  const handleCancel = () => {
    setDialogState((s) => ({ ...s, visible: false }));
    (window as unknown as { __resolveConfirm?: (v: boolean) => void }).__resolveConfirm?.(false);
  };

  return { dialogState, showConfirm, handleCancel };
}
