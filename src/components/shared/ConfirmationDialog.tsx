'use client';

import React, { useCallback } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';

export interface ConfirmationDialogProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'default' | 'success' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Shared Confirmation Dialog Component
 *
 * A reusable dialog for confirming user actions (delete, submit, etc.)
 * Uses DevExtreme Popup for consistent styling across the application.
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   visible={showDeleteConfirm}
 *   title="Delete Item"
 *   message="Are you sure you want to delete this item?"
 *   confirmText="Delete"
 *   confirmType="danger"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDeleteConfirm(false)}
 * />
 * ```
 */
export function ConfirmationDialog({
  visible,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmType = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationDialogProps) {
  const handleConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  const getConfirmButtonType = (): 'default' | 'success' | 'danger' => {
    switch (confirmType) {
      case 'success':
        return 'success';
      case 'danger':
        return 'danger';
      default:
        return 'default';
    }
  };

  const renderContent = () => (
    <div className="flex flex-col gap-4">
      <p className="text-gray-700 text-base">{message}</p>
      <div className="flex justify-end gap-3 pt-2">
        <Button
          text={cancelText}
          type="normal"
          stylingMode="outlined"
          onClick={onCancel}
          disabled={isLoading}
        />
        <Button
          text={confirmText}
          type={getConfirmButtonType()}
          stylingMode="contained"
          onClick={handleConfirm}
          disabled={isLoading}
        />
      </div>
    </div>
  );

  return (
    <Popup
      visible={visible}
      onHiding={onCancel}
      dragEnabled={false}
      hideOnOutsideClick={!isLoading}
      showCloseButton={!isLoading}
      showTitle={true}
      title={title}
      width={400}
      height="auto"
      contentRender={renderContent}
    />
  );
}

export default ConfirmationDialog;
