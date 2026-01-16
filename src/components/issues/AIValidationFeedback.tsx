'use client';

/**
 * AI Validation Feedback Component
 * Feature: Issue Tracker
 *
 * Displays the results of AI-powered issue validation with
 * pass/fail status, missing items, feedback, and follow-up questions.
 */

import { DxButton } from '@/components/ui/dx-button';
import type { AIValidationResult } from '@/types/issues';

// ============================================
// Types
// ============================================

export interface AIValidationFeedbackProps {
  result: AIValidationResult;
  onDismiss?: () => void;
  onRevalidate?: () => void;
  isRevalidating?: boolean;
  className?: string;
}

// ============================================
// Component
// ============================================

export function AIValidationFeedback({
  result,
  onDismiss,
  onRevalidate,
  isRevalidating = false,
  className = '',
}: AIValidationFeedbackProps) {
  const isPassing = result.pass;
  const hasIssues = result.missingItems.length > 0 ||
                    result.feedback.length > 0 ||
                    result.followUpQuestions.length > 0;

  return (
    <div
      className={`rounded-lg border ${
        isPassing
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      } ${className}`}
      data-testid="ai-validation-feedback"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              isPassing ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
            }`}
          >
            {isPassing ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </span>
          <div>
            <h4
              className={`font-semibold ${
                isPassing ? 'text-green-800' : 'text-yellow-800'
              }`}
            >
              {isPassing ? 'Validation Passed' : 'Needs Improvement'}
            </h4>
            {result.aiUnavailable && (
              <p className="text-sm text-gray-500">
                AI service unavailable - basic validation only
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRevalidate && (
            <DxButton
              text={isRevalidating ? 'Validating...' : 'Revalidate'}
              type="default"
              stylingMode="text"
              onClick={onRevalidate}
              disabled={isRevalidating}
              data-testid="revalidate-btn"
            />
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600"
              data-testid="dismiss-btn"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {hasIssues && (
        <div className="p-4 space-y-4">
          {/* Missing Items */}
          {result.missingItems.length > 0 && (
            <div data-testid="missing-items">
              <h5 className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Missing Information
              </h5>
              <ul className="space-y-1">
                {result.missingItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-yellow-600"
                  >
                    <span className="text-yellow-400 mt-0.5">-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feedback */}
          {result.feedback.length > 0 && (
            <div data-testid="feedback-items">
              <h5 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Suggestions
              </h5>
              <ul className="space-y-3">
                {result.feedback.map((item, idx) => (
                  <li
                    key={idx}
                    className="bg-blue-50 rounded p-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-700 uppercase">
                        {item.field}
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 mb-1">
                      <span className="font-medium">Issue:</span> {item.issue}
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Suggestion:</span> {item.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up Questions */}
          {result.followUpQuestions.length > 0 && (
            <div data-testid="followup-questions">
              <h5 className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Questions to Consider
              </h5>
              <ul className="space-y-2">
                {result.followUpQuestions.map((question, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-purple-600"
                  >
                    <span className="text-purple-400 mt-0.5">{idx + 1}.</span>
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Success message when passing with no issues */}
      {isPassing && !hasIssues && (
        <div className="p-4">
          <p className="text-sm text-green-600">
            Your issue description is complete and well-structured. You can proceed to submit.
          </p>
        </div>
      )}
    </div>
  );
}

export default AIValidationFeedback;
