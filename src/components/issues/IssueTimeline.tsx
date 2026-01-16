'use client';

/**
 * Issue Timeline Component
 * Feature: Issue Tracker
 *
 * Displays the timeline/audit history of an issue, including
 * comments, status changes, assignments, and other events.
 */

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { IssueStatus, IssueSeverity, IssuePriority } from '@/types/issues';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { PriorityBadge } from './PriorityBadge';

// ============================================
// Types
// ============================================

export interface IssueTimelineProps {
  issueId: number;
  className?: string;
}

interface TimelineEntry {
  id: string;
  type: 'audit' | 'comment';
  timestamp: Date | string;
  actor: { id: number; name: string; email: string } | null;
  eventType?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  content?: string;
  isEdited?: boolean;
}

interface TimelineItemProps {
  entry: TimelineEntry;
}

interface TimelineApiResponse {
  timeline: TimelineEntry[];
  counts: {
    comments: number;
    auditEvents: number;
    total: number;
  };
}

// ============================================
// API Functions
// ============================================

async function fetchTimeline(issueId: number): Promise<TimelineEntry[]> {
  const response = await fetch(`/api/issues/${issueId}/timeline`);
  const result = await response.json();
  if (!result.success) return [];
  const data = result.data as TimelineApiResponse;
  return data?.timeline || [];
}

// ============================================
// Helper Functions
// ============================================

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

function getEventIcon(type: 'audit' | 'comment', eventType?: string): ReactNode {
  const iconClass = 'w-4 h-4';

  if (type === 'comment') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }

  switch (eventType) {
    case 'status_change':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'assignment':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'severity_change':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'priority_change':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      );
    case 'created':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    case 'merged':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getEventColor(type: 'audit' | 'comment', eventType?: string): string {
  if (type === 'comment') {
    return 'bg-blue-100 text-blue-600';
  }

  switch (eventType) {
    case 'status_change':
      return 'bg-green-100 text-green-600';
    case 'assignment':
      return 'bg-purple-100 text-purple-600';
    case 'severity_change':
      return 'bg-orange-100 text-orange-600';
    case 'priority_change':
      return 'bg-yellow-100 text-yellow-600';
    case 'created':
      return 'bg-emerald-100 text-emerald-600';
    case 'merged':
      return 'bg-indigo-100 text-indigo-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getEventDescription(type: 'audit' | 'comment', eventType?: string): string {
  if (type === 'comment') {
    return 'added a comment';
  }

  switch (eventType) {
    case 'created':
      return 'created this issue';
    case 'status_change':
      return 'changed the status';
    case 'assignment':
      return 'changed the assignee';
    case 'severity_change':
      return 'changed the severity';
    case 'priority_change':
      return 'changed the priority';
    case 'merged':
      return 'merged this issue';
    default:
      return 'made a change';
  }
}

// ============================================
// Timeline Item Component
// ============================================

function TimelineItem({ entry }: TimelineItemProps) {
  const getOldValue = (key: string): string | undefined => {
    const val = entry.oldValue?.[key];
    return val !== undefined && val !== null ? String(val) : undefined;
  };

  const getNewValue = (key: string): string | undefined => {
    const val = entry.newValue?.[key];
    return val !== undefined && val !== null ? String(val) : undefined;
  };

  const renderChangeValue = () => {
    if (!entry.oldValue && !entry.newValue) return null;
    if (entry.type !== 'audit') return null;

    const oldStatus = getOldValue('status');
    const newStatus = getNewValue('status');
    const oldSeverity = getOldValue('severity');
    const newSeverity = getNewValue('severity');
    const oldPriority = getOldValue('priority');
    const newPriority = getNewValue('priority');
    const oldAssignee = getOldValue('assigneeName');
    const newAssignee = getNewValue('assigneeName');

    switch (entry.eventType) {
      case 'status_change':
        return (
          <div className="flex items-center gap-2 mt-1">
            {oldStatus && (
              <>
                <StatusBadge status={oldStatus as IssueStatus} size="sm" />
                <span className="text-gray-400">→</span>
              </>
            )}
            {newStatus && (
              <StatusBadge status={newStatus as IssueStatus} size="sm" />
            )}
          </div>
        );
      case 'severity_change':
        return (
          <div className="flex items-center gap-2 mt-1">
            {oldSeverity && (
              <>
                <SeverityBadge severity={oldSeverity as IssueSeverity} size="sm" />
                <span className="text-gray-400">→</span>
              </>
            )}
            {newSeverity && (
              <SeverityBadge severity={newSeverity as IssueSeverity} size="sm" />
            )}
          </div>
        );
      case 'priority_change':
        return (
          <div className="flex items-center gap-2 mt-1">
            {oldPriority && (
              <>
                <PriorityBadge priority={oldPriority as IssuePriority} size="sm" />
                <span className="text-gray-400">→</span>
              </>
            )}
            {newPriority && (
              <PriorityBadge priority={newPriority as IssuePriority} size="sm" />
            )}
          </div>
        );
      case 'assignment':
        return (
          <div className="text-sm text-gray-600 mt-1">
            {oldAssignee && <span>From: {oldAssignee}</span>}
            {oldAssignee && newAssignee && <span> • </span>}
            {newAssignee && <span>To: {newAssignee}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-4" data-testid={`timeline-entry-${entry.id}`}>
      {/* Icon */}
      <div className="flex-shrink-0">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(entry.type, entry.eventType)}`}
        >
          {getEventIcon(entry.type, entry.eventType)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            {entry.actor?.name || 'System'}
          </span>
          <span className="text-gray-500 text-sm">
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
        <p className="text-gray-700 text-sm mt-0.5">
          {getEventDescription(entry.type, entry.eventType)}
        </p>
        {renderChangeValue()}
        {entry.content && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
            {entry.content}
            {entry.isEdited && (
              <span className="text-gray-400 text-xs ml-2">(edited)</span>
            )}
          </div>
        )}
      </div>

      {/* Time tooltip */}
      <div className="flex-shrink-0 text-xs text-gray-400" title={formatDate(entry.timestamp)}>
        {formatTime(entry.timestamp)}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function IssueTimeline({ issueId, className = '' }: IssueTimelineProps) {
  const { data: timeline, isLoading, error } = useQuery({
    queryKey: ['issue-timeline', issueId],
    queryFn: () => fetchTimeline(issueId),
  });

  if (isLoading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 ${className}`}>
        Failed to load timeline
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className={`p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-center ${className}`}>
        No activity yet
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid="issue-timeline">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

      {/* Timeline entries */}
      <div className="space-y-0">
        {timeline.map((entry) => (
          <TimelineItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export default IssueTimeline;
