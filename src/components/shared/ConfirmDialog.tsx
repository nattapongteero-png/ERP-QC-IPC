'use client';

/**
 * Custom Confirm Dialog with data-testid support
 * Replaces DevExtreme's confirm() dialog for better E2E testing
 */

import * as React from 'react';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';

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
  confirmText = 'ใช่',
  cancelText = 'ไม่',
  testIdPrefix = 'confirm-dialog',
}: ConfirmDialogProps) {
  return (
    <Popup
      visible={visible}
      title={title}
      showCloseButton={false}
      width={400}
      height="auto"
      dragEnabled={false}
      onHiding={onCancel}
      wrapperAttr={{
        'data-testid': `${testIdPrefix}-dialog`,
      }}
    >
      <div className="p-4">
        <div
          className="mb-6 text-base"
          dangerouslySetInnerHTML={{ __html: message }}
          data-testid={`${testIdPrefix}-message`}
        />
        <div className="flex justify-end gap-2">
          <Button
            text={confirmText}
            type="default"
            stylingMode="contained"
            onClick={onConfirm}
            data-testid={`${testIdPrefix}-confirm-btn`}
            elementAttr={{
              'data-testid': `${testIdPrefix}-confirm-btn`,
            }}
          />
          <Button
            text={cancelText}
            type="normal"
            stylingMode="outlined"
            onClick={onCancel}
            data-testid={`${testIdPrefix}-cancel-btn`}
            elementAttr={{
              'data-testid': `${testIdPrefix}-cancel-btn`,
            }}
          />
        </div>
      </div>
    </Popup>
  );
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    testIdPrefix: string;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    testIdPrefix: 'confirm-dialog',
  });

  const showConfirm = React.useCallback(
    (
      message: string,
      title: string,
      testIdPrefix: string = 'confirm-dialog'
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({
          visible: true,
          title,
          message,
          testIdPrefix,
          onConfirm: () => {
            setDialogState((prev) => ({ ...prev, visible: false }));
            resolve(true);
          },
        });
      });
    },
    []
  );

  const handleCancel = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    dialogState,
    showConfirm,
    handleCancel,
  };
}
