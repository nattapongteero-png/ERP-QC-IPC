/**
 * Confidentiality Banner Component
 * Feature: BOM Confidentiality Protection
 *
 * Displays a warning banner for BOMs with confidential items.
 * Shows different messages based on user's access level.
 */

'use client';

import { Lock, AlertTriangle } from 'lucide-react';
import type { BOMConfidentialityInfo } from '@/types/confidentiality';

export interface ConfidentialityBannerProps {
  confidentialityInfo: BOMConfidentialityInfo;
  variant?: 'info' | 'warning';
  className?: string;
}

/**
 * Confidentiality banner that displays access status for BOMs with confidential items.
 *
 * @param confidentialityInfo - Object containing confidentiality metadata
 * @param variant - 'info' for neutral tone, 'warning' for limited access emphasis
 * @param className - Additional CSS classes
 */
export function ConfidentialityBanner({
  confidentialityInfo,
  variant = 'info',
  className = '',
}: ConfidentialityBannerProps) {
  // Don't render if no confidential items
  if (!confidentialityInfo.hasConfidentialItems) {
    return null;
  }

  const { userHasFullAccess, visibleLineCount, totalLineCount } = confidentialityInfo;
  const hiddenCount = totalLineCount - visibleLineCount;

  // Determine styling based on variant and access level
  const isWarning = variant === 'warning' || !userHasFullAccess;

  const bgColor = isWarning ? 'bg-amber-50' : 'bg-blue-50';
  const borderColor = isWarning ? 'border-amber-200' : 'border-blue-200';
  const textColor = isWarning ? 'text-amber-700' : 'text-blue-700';
  const iconColor = isWarning ? 'text-amber-600' : 'text-blue-600';

  const Icon = isWarning ? AlertTriangle : Lock;

  return (
    <div
      className={`flex items-center gap-2 p-3 ${bgColor} border ${borderColor} rounded-lg ${className}`}
      data-testid="confidentiality-banner"
      role="alert"
      aria-live="polite"
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} />
      <span className={`text-sm ${textColor}`}>
        {userHasFullAccess ? (
          <>
            This BOM contains confidential items. You have full access to view all{' '}
            <strong>{totalLineCount}</strong> items.
          </>
        ) : hiddenCount === 1 ? (
          <>
            This BOM contains <strong>1 confidential item</strong> you cannot view.
            Showing <strong>{visibleLineCount}</strong> of <strong>{totalLineCount}</strong> items.
          </>
        ) : (
          <>
            This BOM contains <strong>{hiddenCount} confidential items</strong> you cannot view.
            Showing <strong>{visibleLineCount}</strong> of <strong>{totalLineCount}</strong> items.
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Compact version for use in list views or cards
 */
export function ConfidentialityBadge({
  confidentialityInfo,
  className = '',
}: {
  confidentialityInfo: BOMConfidentialityInfo;
  className?: string;
}) {
  if (!confidentialityInfo.hasConfidentialItems) {
    return null;
  }

  const { userHasFullAccess, visibleLineCount, totalLineCount } = confidentialityInfo;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
        userHasFullAccess
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700'
      } ${className}`}
      title={
        userHasFullAccess
          ? 'You have full access to confidential items'
          : `Showing ${visibleLineCount} of ${totalLineCount} items`
      }
      data-testid="confidentiality-badge"
    >
      <Lock className="h-3 w-3" />
      {userHasFullAccess ? 'Full Access' : `${visibleLineCount}/${totalLineCount}`}
    </span>
  );
}

export default ConfidentialityBanner;
