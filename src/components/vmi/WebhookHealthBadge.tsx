'use client';

/**
 * VMI Webhook Health Badge Component
 *
 * Displays the health status of a webhook with appropriate styling.
 * Shows different states: active, warning, disabled by failures, disabled manual.
 *
 * Feature: 012-vmi-webhook
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  PauseCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VmiWebhookHealthStatus } from '@/types/vmi';

// ============================================================================
// Types
// ============================================================================

export interface WebhookHealthBadgeProps {
  status: VmiWebhookHealthStatus;
  consecutiveFailures?: number;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
  VmiWebhookHealthStatus,
  {
    label: string;
    labelTh: string;
    icon: typeof CheckCircle;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeVariant: 'success' | 'warning' | 'danger' | 'info';
  }
> = {
  active: {
    label: 'Active',
    labelTh: 'ทำงานปกติ',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badgeVariant: 'success',
  },
  warning: {
    label: 'Warning',
    labelTh: 'มีปัญหา',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeVariant: 'warning',
  },
  disabled_by_failures: {
    label: 'Auto-Disabled',
    labelTh: 'ปิดอัตโนมัติ',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeVariant: 'danger',
  },
  disabled_manual: {
    label: 'Disabled',
    labelTh: 'ปิดใช้งาน',
    icon: PauseCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeVariant: 'info',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('th-TH');
}

// ============================================================================
// Simple Badge Component
// ============================================================================

export function WebhookHealthBadge({
  status,
  consecutiveFailures = 0,
  lastSuccessAt,
  lastFailureAt,
  size = 'md',
  showDetails = false,
  className,
}: WebhookHealthBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  if (!showDetails) {
    return (
      <Badge variant={config.badgeVariant} dot className={className}>
        {config.labelTh}
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        sizeClasses[size],
        config.bgColor,
        config.color,
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.labelTh}</span>
      {consecutiveFailures > 0 && status !== 'disabled_manual' && (
        <span className="text-xs opacity-75">({consecutiveFailures})</span>
      )}
    </div>
  );
}

// ============================================================================
// Detailed Health Card Component
// ============================================================================

export interface WebhookHealthCardProps {
  status: VmiWebhookHealthStatus;
  consecutiveFailures?: number;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastErrorMessage?: string | null;
  onReEnable?: () => void;
  isReEnabling?: boolean;
  className?: string;
}

export function WebhookHealthCard({
  status,
  consecutiveFailures = 0,
  lastSuccessAt,
  lastFailureAt,
  lastErrorMessage,
  onReEnable,
  isReEnabling = false,
  className,
}: WebhookHealthCardProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', config.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4 className={cn('font-semibold', config.color)}>
              {config.labelTh}
            </h4>
            <p className="text-xs text-gray-500">{config.label}</p>
          </div>
        </div>
        {consecutiveFailures > 0 && status !== 'disabled_manual' && (
          <div className="text-right">
            <span className="text-2xl font-bold text-red-600">
              {consecutiveFailures}
            </span>
            <p className="text-xs text-gray-500">failures</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-2 bg-white/50 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <CheckCircle className="h-3 w-3 text-green-500" />
            Last Success
          </div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">
            {formatTimeAgo(lastSuccessAt)}
          </p>
        </div>
        <div className="p-2 bg-white/50 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <XCircle className="h-3 w-3 text-red-500" />
            Last Failure
          </div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">
            {formatTimeAgo(lastFailureAt)}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {lastErrorMessage && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-lg mb-3">
          <p className="text-xs text-red-600 line-clamp-2">{lastErrorMessage}</p>
        </div>
      )}

      {/* Action */}
      {status === 'disabled_by_failures' && onReEnable && (
        <button
          onClick={onReEnable}
          disabled={isReEnabling}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
            'bg-white border border-gray-200 text-gray-700 font-medium text-sm',
            'hover:bg-gray-50 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isReEnabling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {isReEnabling ? 'Re-enabling...' : 'Re-enable Webhook'}
        </button>
      )}

      {/* Help Text */}
      {status === 'warning' && (
        <p className="text-xs text-amber-700 mt-2">
          This webhook has experienced {consecutiveFailures} consecutive failures.
          It will be auto-disabled after 10 failures.
        </p>
      )}

      {status === 'disabled_by_failures' && (
        <p className="text-xs text-red-700 mt-2">
          This webhook was auto-disabled after 10 consecutive failures.
          Check your endpoint and re-enable when ready.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Inline Status Indicator
// ============================================================================

export interface WebhookStatusIndicatorProps {
  status: VmiWebhookHealthStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function WebhookStatusIndicator({
  status,
  size = 'md',
  className,
}: WebhookStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full',
          dotSizes[size],
          status === 'active' && 'bg-green-500 animate-pulse',
          status === 'warning' && 'bg-amber-500',
          status === 'disabled_by_failures' && 'bg-red-500',
          status === 'disabled_manual' && 'bg-gray-400'
        )}
      />
      <span className={cn('text-sm', config.color)}>{config.labelTh}</span>
    </div>
  );
}

export default WebhookHealthBadge;
