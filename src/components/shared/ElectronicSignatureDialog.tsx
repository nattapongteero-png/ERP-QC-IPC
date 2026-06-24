'use client';

import React, { useState, useCallback } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { Shield, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useErrorTranslator } from '@/lib/i18n/use-error-translator';

export interface ElectronicSignatureDialogProps {
  visible: boolean;
  title?: string;
  action: string;
  meaning: string;
  customMeaning?: boolean;
  onSign: (password: string, meaning: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Electronic Signature Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US13 - T071)
 *
 * 21 CFR Part 11 compliant electronic signature dialog:
 * - Password verification before signing
 * - Meaning/intent capture for each signature
 * - Visual feedback for success/error states
 *
 * @example
 * ```tsx
 * <ElectronicSignatureDialog
 *   visible={showSignDialog}
 *   title="Verify Line Clearance"
 *   action="verify_approve"
 *   meaning="I confirm that I have reviewed and verified the line clearance checklist."
 *   onSign={async (password, meaning) => {
 *     const result = await verifyLineClearance({ password, meaning });
 *     return { success: result.success, error: result.error };
 *   }}
 *   onCancel={() => setShowSignDialog(false)}
 * />
 * ```
 */
export function ElectronicSignatureDialog({
  visible,
  title = 'จำเป็นต้องมีลายเซ็นอิเล็กทรอนิกส์',
  action,
  meaning: defaultMeaning,
  customMeaning = false,
  onSign,
  onCancel,
  isLoading: externalLoading = false,
}: ElectronicSignatureDialogProps) {
  const translateError = useErrorTranslator();
  const [password, setPassword] = useState('');
  const [meaning, setMeaning] = useState(defaultMeaning);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isLoading = externalLoading || isSubmitting;

  const handleSign = useCallback(async () => {
    if (!password) {
      setError('จำเป็นต้องกรอกรหัสผ่าน');
      return;
    }

    if (customMeaning && !meaning.trim()) {
      setError('จำเป็นต้องระบุความหมายของลายเซ็น');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await onSign(password, meaning);

      if (result.success) {
        setSuccess(true);
        // Auto-close after success
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        // Translate the API's English error to the active locale for display.
        setError(translateError(result.error));
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  }, [password, meaning, customMeaning, onSign, translateError]);

  const handleClose = useCallback(() => {
    setPassword('');
    setMeaning(defaultMeaning);
    setError(null);
    setSuccess(false);
    onCancel();
  }, [defaultMeaning, onCancel]);

  const renderContent = () => (
    <div className="flex flex-col gap-4 py-2">
      {/* Security Notice */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">ลายเซ็นที่สอดคล้องกับ 21 CFR Part 11</p>
          <p className="text-xs text-blue-600 mt-1">
            ลายเซ็นของคุณจะถูกบันทึกอย่างปลอดภัยพร้อมเวลาประทับและแฮชสำหรับการตรวจสอบ
          </p>
        </div>
      </div>

      {/* Meaning Display */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-1">ความหมายของลายเซ็น:</p>
        {customMeaning ? (
          <TextArea
            value={meaning}
            onValueChange={setMeaning}
            placeholder="กรอกความหมายของลายเซ็น..."
            height={80}
            disabled={isLoading}
          />
        ) : (
          <p className="text-sm text-gray-600 italic">&ldquo;{meaning}&rdquo;</p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <KeyRound className="h-4 w-4" />
          กรอกรหัสผ่านเพื่อลงนาม
        </label>
        <TextBox
          mode="password"
          value={password}
          onValueChange={(value) => {
            setPassword(value);
            setError(null);
          }}
          placeholder="กรอกรหัสผ่าน..."
          disabled={isLoading || success}
          onEnterKey={handleSign}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">บันทึกลายเซ็นเรียบร้อยแล้ว!</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
        <Button
          text="ยกเลิก"
          type="normal"
          stylingMode="outlined"
          onClick={handleClose}
          disabled={isLoading}
        />
        <Button
          text={isSubmitting ? 'กำลังลงนาม...' : 'ลงนาม'}
          type="success"
          stylingMode="contained"
          onClick={handleSign}
          disabled={isLoading || success || !password}
          icon="check"
        />
      </div>
    </div>
  );

  return (
    <Popup
      visible={visible}
      onHiding={handleClose}
      dragEnabled={false}
      hideOnOutsideClick={!isLoading && !success}
      showCloseButton={!isLoading && !success}
      showTitle={true}
      title={title}
      width={480}
      height="auto"
      contentRender={renderContent}
    />
  );
}

export default ElectronicSignatureDialog;
