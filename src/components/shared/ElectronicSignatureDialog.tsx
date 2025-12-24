'use client';

import React, { useState, useCallback } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { Shield, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

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
  title = 'Electronic Signature Required',
  action,
  meaning: defaultMeaning,
  customMeaning = false,
  onSign,
  onCancel,
  isLoading: externalLoading = false,
}: ElectronicSignatureDialogProps) {
  const [password, setPassword] = useState('');
  const [meaning, setMeaning] = useState(defaultMeaning);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isLoading = externalLoading || isSubmitting;

  const handleSign = useCallback(async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    if (customMeaning && !meaning.trim()) {
      setError('Signature meaning is required');
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
        setError(result.error || 'Signature failed. Please check your password and try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [password, meaning, customMeaning, onSign]);

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
          <p className="text-sm font-medium text-blue-800">21 CFR Part 11 Compliant Signature</p>
          <p className="text-xs text-blue-600 mt-1">
            Your signature will be securely recorded with timestamp and verification hash.
          </p>
        </div>
      </div>

      {/* Meaning Display */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-1">Signature Meaning:</p>
        {customMeaning ? (
          <TextArea
            value={meaning}
            onValueChange={setMeaning}
            placeholder="Enter signature meaning..."
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
          Enter Your Password to Sign
        </label>
        <TextBox
          mode="password"
          value={password}
          onValueChange={(value) => {
            setPassword(value);
            setError(null);
          }}
          placeholder="Enter your password..."
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
          <p className="text-sm text-green-700">Signature recorded successfully!</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
        <Button
          text="Cancel"
          type="normal"
          stylingMode="outlined"
          onClick={handleClose}
          disabled={isLoading}
        />
        <Button
          text={isSubmitting ? 'Signing...' : 'Sign'}
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
