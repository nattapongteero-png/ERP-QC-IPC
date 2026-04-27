'use client';

/**
 * AwaitingOtherVerifierBadge
 *
 * Shown in place of a "Verify" button when the current user is the operator
 * of a completed step. Communicates the GMP dual-control rule upfront so
 * users don't discover it via an error-after-click.
 *
 * Usage:
 *   {canVerify ? (
 *     <VerifyButton onClick={...} />
 *   ) : isOwnOperator ? (
 *     <AwaitingOtherVerifierBadge />
 *   ) : null}
 */

import { AlertCircle } from 'lucide-react';

export interface AwaitingOtherVerifierBadgeProps {
  /** Override the default label (e.g. 'รอ QA ตรวจสอบ') */
  label?: string;
  /** Override the default tooltip */
  tooltip?: string;
  /** Additional CSS classes */
  className?: string;
}

export function AwaitingOtherVerifierBadge({
  label = 'รอผู้ตรวจสอบคนอื่น',
  tooltip = 'คุณเป็นผู้ปฏิบัติงาน — ต้องให้ผู้อื่นมาตรวจสอบตามหลัก GMP Dual-Control',
  className = '',
}: AwaitingOtherVerifierBadgeProps = {}) {
  return (
    <div
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-sm font-medium ${className}`}
    >
      <AlertCircle className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}
