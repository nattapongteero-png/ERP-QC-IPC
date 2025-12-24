'use client';

import React from 'react';
import { Shield, Clock, User, FileSignature, CheckCircle2, XCircle } from 'lucide-react';

export interface SignatureData {
  id: number;
  fullName: string;
  title?: string;
  signedAt: string | Date;
  meaning: string;
  action: string;
  passwordVerified: boolean;
  integrityValid?: boolean;
}

export interface SignatureDisplayProps {
  signatures: SignatureData[];
  title?: string;
  showIntegrity?: boolean;
  className?: string;
}

/**
 * Signature Display Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (T097)
 *
 * Displays electronic signature details per FR-074:
 * - Full name and title
 * - Timestamp
 * - Meaning statement
 * - Signature ID
 * - Integrity verification status (optional)
 *
 * @example
 * ```tsx
 * <SignatureDisplay
 *   signatures={[
 *     {
 *       id: 1,
 *       fullName: 'John Doe',
 *       title: 'QC Manager',
 *       signedAt: '2025-12-24T10:30:00Z',
 *       meaning: 'I verify this label is correct',
 *       action: 'verify',
 *       passwordVerified: true
 *     }
 *   ]}
 *   title="Verification Signatures"
 *   showIntegrity
 * />
 * ```
 */
export function SignatureDisplay({
  signatures,
  title = 'Electronic Signatures',
  showIntegrity = false,
  className = '',
}: SignatureDisplayProps) {
  if (!signatures || signatures.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Shield className="w-5 h-5" />
          <span>No signatures recorded</span>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      perform: 'Performed By',
      verify: 'Verified By',
      approve: 'Approved By',
      witness: 'Witnessed By',
      reject: 'Rejected By',
      verify_approve: 'Verified & Approved By',
    };
    return labels[action] || action;
  };

  return (
    <div className={`bg-white border rounded-lg ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <Shield className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-gray-800">{title}</span>
        <span className="text-sm text-gray-500">({signatures.length})</span>
      </div>

      <div className="divide-y">
        {signatures.map((sig) => (
          <div key={sig.id} className="p-4">
            <div className="flex flex-wrap gap-4 mb-2">
              {/* Signer Info */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-800">{sig.fullName}</span>
                {sig.title && (
                  <span className="text-sm text-gray-500">({sig.title})</span>
                )}
              </div>

              {/* Action Label */}
              <div className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm">
                {getActionLabel(sig.action)}
              </div>

              {/* Password Verified Badge */}
              {sig.passwordVerified && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Password Verified</span>
                </div>
              )}

              {/* Integrity Badge */}
              {showIntegrity && sig.integrityValid !== undefined && (
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${
                    sig.integrityValid
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {sig.integrityValid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Valid</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      <span>Tampered</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Clock className="w-4 h-4" />
              <span>{formatDate(sig.signedAt)}</span>
            </div>

            {/* Meaning Statement */}
            <div className="flex items-start gap-2 bg-gray-50 rounded p-3 mt-2">
              <FileSignature className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <div className="text-xs text-gray-400 mb-1">Meaning Statement</div>
                <div className="text-sm text-gray-700 italic">&ldquo;{sig.meaning}&rdquo;</div>
              </div>
            </div>

            {/* Signature ID */}
            <div className="mt-2 text-xs text-gray-400">
              Signature ID: #{sig.id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SignatureDisplay;
