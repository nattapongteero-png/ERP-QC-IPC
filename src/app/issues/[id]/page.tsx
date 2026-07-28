'use client';

/**
 * Issue Detail Page
 * Feature: Issue Tracker
 *
 * Displays full issue details with timeline and comments.
 */

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  Bug,
  User,
  Calendar,
  Clock,
  Tag,
  Edit,
  AlertTriangle,
} from 'lucide-react';
import { Button } from 'devextreme-react/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  StatusBadge,
  SeverityBadge,
  PriorityBadge,
  IssueTimeline,
  CommentEditor,
} from '@/components/issues';
import { StatusStepper } from '@/components/shared';
import type { Issue } from '@/types/issues';

// ============================================
// Types
// ============================================

interface PageProps {
  params: Promise<{ id: string }>;
}

// ============================================
// API Functions
// ============================================

async function fetchIssue(id: number): Promise<Issue> {
  const res = await fetch(`/api/issues/${id}`);
  if (!res.ok) throw new Error('Failed to fetch issue');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch issue');
  return data.data;
}

// ============================================
// Helper Functions
// ============================================

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useRelativeDate() {
  const t = useTranslations('issues');
  return (date: string | Date): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return t('detail.relative.today');
    if (diffDays === 1) return t('detail.relative.yesterday');
    if (diffDays < 7) return t('detail.relative.daysAgo', { days: diffDays });
    if (diffDays < 30) return t('detail.relative.weeksAgo', { weeks: Math.floor(diffDays / 7) });
    return d.toLocaleDateString();
  };
}

// ============================================
// Page Header Component
// ============================================

function IssueDetailPageHeader({ issue }: { issue: Issue }) {
  const t = useTranslations('issues');
  const formatRelativeDate = useRelativeDate();
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-4">
        <Link href="/issues/list" className="p-2 hover:bg-gray-100 rounded-lg mt-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-gray-500 font-mono text-lg">{issue.issueNumber}</span>
            <StatusBadge status={issue.status} />
            <SeverityBadge severity={issue.severity} />
            {issue.priority && <PriorityBadge priority={issue.priority} />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
          <p className="text-gray-600 mt-1">
            {t('detail.reportedBy')} {issue.reporter?.name || t('detail.unknown')} • {formatRelativeDate(issue.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/issues/${issue.id}/edit`}>
          <Button
            text={t('actions.edit')}
            type="normal"
            stylingMode="outlined"
            icon="edit"
            elementAttr={{ 'data-testid': 'edit-issue-btn' }}
          />
        </Link>
      </div>
    </div>
  );
}

// ============================================
// Description Section
// ============================================

function DescriptionSection({ issue }: { issue: Issue }) {
  const t = useTranslations('issues');
  const description = issue.description;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          {t('detail.description')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">{t('detail.summary')}</h4>
          <p className="text-gray-900 whitespace-pre-wrap">{description.summary}</p>
        </div>

        {/* Impact */}
        {description.impact && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">{t('detail.impact')}</h4>
            <p className="text-gray-900 whitespace-pre-wrap">{description.impact}</p>
          </div>
        )}

        {/* Environment */}
        {description.environment && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">{t('detail.environment')}</h4>
            <p className="text-gray-600 font-mono text-sm bg-gray-50 p-2 rounded">
              {description.environment}
            </p>
          </div>
        )}

        {/* Expected vs Actual Behavior */}
        {(description.expectedBehavior || description.actualBehavior) && (
          <div className="grid grid-cols-2 gap-4">
            {description.expectedBehavior && (
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-1">{t('detail.expectedBehavior')}</h4>
                <p className="text-gray-900 whitespace-pre-wrap bg-green-50 p-3 rounded">
                  {description.expectedBehavior}
                </p>
              </div>
            )}
            {description.actualBehavior && (
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-1">{t('detail.actualBehavior')}</h4>
                <p className="text-gray-900 whitespace-pre-wrap bg-red-50 p-3 rounded">
                  {description.actualBehavior}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Steps to Reproduce */}
        {description.stepsToReproduce && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">{t('detail.stepsToReproduce')}</h4>
            <div className="bg-gray-50 p-3 rounded">
              <pre className="text-gray-900 whitespace-pre-wrap text-sm">
                {description.stepsToReproduce}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Metadata Sidebar
// ============================================

function MetadataSidebar({ issue }: { issue: Issue }) {
  const t = useTranslations('issues');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('detail.details')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Tag className="w-4 h-4" />
            {t('detail.category')}
          </div>
          <p className="font-medium">{issue.category?.name || t('detail.uncategorized')}</p>
        </div>

        {/* Assignee */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <User className="w-4 h-4" />
            {t('detail.assignee')}
          </div>
          <p className="font-medium">
            {issue.assignee?.name || (
              <span className="text-gray-400">{t('detail.unassigned')}</span>
            )}
          </p>
        </div>

        {/* Reporter */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <User className="w-4 h-4" />
            {t('detail.reporter')}
          </div>
          <p className="font-medium">{issue.reporter?.name || t('detail.unknown')}</p>
        </div>

        {/* Created */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            {t('detail.created')}
          </div>
          <p className="text-sm">{formatDate(issue.createdAt)}</p>
        </div>

        {/* Updated */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            {t('detail.updated')}
          </div>
          <p className="text-sm">{formatDate(issue.updatedAt)}</p>
        </div>

        {/* Tags */}
        {issue.tags && issue.tags.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Tag className="w-4 h-4" />
              {t('detail.tags')}
            </div>
            <div className="flex flex-wrap gap-1">
              {issue.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                  style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Activity Section
// ============================================

function ActivitySection({ issueId }: { issueId: number }) {
  const t = useTranslations('issues');
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('detail.activity')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <IssueTimeline issueId={issueId} />
      </CardContent>
    </Card>
  );
}

// ============================================
// Comments Section
// ============================================

function CommentsSection({ issueId }: { issueId: number }) {
  const t = useTranslations('issues');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit className="w-5 h-5" />
          {t('detail.addComment')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CommentEditor issueId={issueId} />
      </CardContent>
    </Card>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function IssueDetailSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-2" />
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 bg-gray-200 rounded-lg" />
          <div className="h-96 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-80 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IssueDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const issueId = parseInt(resolvedParams.id, 10);
  const router = useRouter();
  const t = useTranslations('issues');

  const { data: issue, isLoading, error } = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => fetchIssue(issueId),
    enabled: !isNaN(issueId),
  });

  if (isLoading) {
    return <IssueDetailSkeleton />;
  }

  if (error || !issue) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <Link href="/issues/list" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('error.notFound')}</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t('error.unableToLoad')}
            </h2>
            <p className="text-gray-600 mb-4">
              {error?.message || t('error.notExistsOrDeleted')}
            </p>
            <Button
              text={t('actions.backToIssues')}
              type="default"
              stylingMode="contained"
              onClick={() => router.push('/issues/list')}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="issue-detail-page">
      <IssueDetailPageHeader issue={issue} />

      <div className="mb-6">
        <StatusStepper
          title={t(`workflowStatus`)}
          steps={[
            { key: 'draft', label: 'ร่าง' },
            { key: 'submitted', label: 'ส่งเรื่อง' },
            { key: 'triaged', label: 'คัดกรอง' },
            { key: 'in_progress', label: 'กำลังแก้ไข' },
            { key: 'resolved', label: 'แก้ไขแล้ว' },
            { key: 'verified', label: 'ตรวจสอบแล้ว' },
            { key: 'closed', label: 'ปิดเรื่อง' },
          ]}
          current={String(issue.status).toLowerCase()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <DescriptionSection issue={issue} />
          <ActivitySection issueId={issue.id} />
          <CommentsSection issueId={issue.id} />
        </div>

        {/* Sidebar */}
        <div>
          <MetadataSidebar issue={issue} />
        </div>
      </div>
    </div>
  );
}
