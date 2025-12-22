'use client';

/**
 * ApprovalChain Component
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Displays an approval workflow chain showing each step in the approval process.
 * Used in Document Control, Change Control, and other approval-based workflows.
 */

import React from 'react';
import { CheckCircle, XCircle, Clock, User, ChevronRight } from 'lucide-react';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export interface ApprovalStep {
  /** Unique identifier for this step */
  id: number | string;
  /** Role or title of the approver */
  role: string;
  /** Name of the person assigned to this step */
  approverName?: string;
  /** Current status of this approval step */
  status: ApprovalStatus;
  /** When the approval was signed/completed */
  signedAt?: string | null;
  /** Any comments from the approver */
  comments?: string | null;
  /** If this was delegated from another user */
  delegatedFrom?: string | null;
}

export interface ApprovalChainProps {
  /** Array of approval steps in order */
  steps: ApprovalStep[];
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Current step index (0-based) */
  currentStep?: number;
  /** Additional CSS classes */
  className?: string;
}

interface StepIconConfig {
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
}

function getStepConfig(status: ApprovalStatus, isCurrent: boolean): StepIconConfig {
  if (status === 'approved') {
    return {
      icon: <CheckCircle className="h-5 w-5 text-white" />,
      bgColor: 'bg-green-500',
      borderColor: 'border-green-500',
    };
  }
  if (status === 'rejected') {
    return {
      icon: <XCircle className="h-5 w-5 text-white" />,
      bgColor: 'bg-red-500',
      borderColor: 'border-red-500',
    };
  }
  if (isCurrent) {
    return {
      icon: <Clock className="h-5 w-5 text-blue-600" />,
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-500',
    };
  }
  return {
    icon: <User className="h-5 w-5 text-gray-400" />,
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  };
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ApprovalChain({
  steps,
  compact = false,
  currentStep,
  className = '',
}: ApprovalChainProps) {
  // Determine current step if not provided
  const effectiveCurrentStep =
    currentStep ??
    steps.findIndex((step) => step.status === 'pending');

  if (compact) {
    return (
      <div className={`flex items-center flex-wrap gap-1 ${className}`}>
        {steps.map((step, index) => {
          const config = getStepConfig(step.status, index === effectiveCurrentStep);
          return (
            <React.Fragment key={step.id}>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full border ${config.borderColor} ${config.bgColor}`}
                title={`${step.role}: ${step.approverName || 'ยังไม่กำหนด'}`}
              >
                <span className="text-xs font-medium truncate max-w-[100px]">
                  {step.role}
                </span>
                {step.status === 'approved' && (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                )}
                {step.status === 'rejected' && (
                  <XCircle className="h-3 w-3 text-red-600" />
                )}
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {steps.map((step, index) => {
        const config = getStepConfig(step.status, index === effectiveCurrentStep);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative flex gap-4">
            {/* Vertical line connector */}
            {!isLast && (
              <div
                className={`absolute left-4 top-10 w-0.5 h-[calc(100%-2rem)] ${
                  step.status === 'approved' ? 'bg-green-300' : 'bg-gray-200'
                }`}
              />
            )}

            {/* Step icon */}
            <div
              className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${config.bgColor} ${config.borderColor}`}
            >
              {config.icon}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{step.role}</p>
                  {step.approverName && (
                    <p className="text-sm text-gray-600">
                      {step.approverName}
                      {step.delegatedFrom && (
                        <span className="text-gray-400">
                          {' '}
                          (มอบหมายจาก {step.delegatedFrom})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {step.status === 'approved' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      อนุมัติแล้ว
                    </span>
                  )}
                  {step.status === 'rejected' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                      ถูกปฏิเสธ
                    </span>
                  )}
                  {step.status === 'pending' && index === effectiveCurrentStep && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      รอการอนุมัติ
                    </span>
                  )}
                  {step.status === 'pending' && index !== effectiveCurrentStep && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                      รอดำเนินการ
                    </span>
                  )}
                </div>
              </div>

              {step.signedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(step.signedAt)}
                </p>
              )}

              {step.comments && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  &ldquo;{step.comments}&rdquo;
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ApprovalChain;
