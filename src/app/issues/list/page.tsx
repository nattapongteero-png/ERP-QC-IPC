'use client';

/**
 * Issues List Page
 * Feature: Issue Tracker
 *
 * Professional data grid with filtering, search, and CRUD operations.
 */

import * as React from 'react';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Bug } from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, SeverityBadge, PriorityBadge } from '@/components/issues';
import { ResponsivePageHeader } from '@/components/shared';
import type { Issue, IssueCategory } from '@/types/issues';

// ============================================
// Types
// ============================================

interface ListResponse {
  items: Issue[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FetchParams {
  status?: string;
  severity?: string;
  categoryId?: number;
  assignedToMe?: boolean;
  search?: string;
}

// ============================================
// API Functions
// ============================================

async function fetchIssues(params?: FetchParams): Promise<ListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.categoryId) searchParams.set('categoryId', String(params.categoryId));
  if (params?.assignedToMe) searchParams.set('assignedToMe', 'true');
  if (params?.search) searchParams.set('search', params.search);
  searchParams.set('limit', '100');

  const res = await fetch(`/api/issues?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch issues');
  const data = await res.json();
  return data.data;
}

async function fetchCategories(): Promise<IssueCategory[]> {
  const res = await fetch('/api/issues/categories?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.data || [];
}

// ============================================
// Page Header Component
// ============================================

function IssuesListPageHeader() {
  const router = useRouter();
  const t = useTranslations('issues');
  return (
    <div className="mb-4 md:mb-6">
      <ResponsivePageHeader
        title={t('list.title')}
        subtitle={t('list.subtitle')}
        icon={Bug}
        iconBgColor="bg-rose-100"
        iconColor="text-rose-600"
        onBack={() => router.push('/issues')}
        actions={
          <Link href="/issues/new">
            <Button
              text={t('actions.reportIssue')}
              type="default"
              stylingMode="contained"
              icon="add"
              elementAttr={{ 'data-testid': 'new-issue-btn' }}
            />
          </Link>
        }
      />
    </div>
  );
}

// ============================================
// Main Component
// ============================================

function IssuesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('issues');
  const locale = useLocale();

  // Get initial filters from URL params
  const initialStatus = searchParams.get('status') || '';
  const initialSeverity = searchParams.get('severity') || '';
  const initialAssignedToMe = searchParams.get('assignedToMe') === 'true';

  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState(initialStatus);
  const [severityFilter, setSeverityFilter] = React.useState(initialSeverity);
  const [categoryFilter, setCategoryFilter] = React.useState<number | null>(null);
  const [assignedToMe, setAssignedToMe] = React.useState(initialAssignedToMe);

  // Fetch issues
  const { data: issuesData, isLoading, isFetching } = useQuery({
    queryKey: ['issues-list', statusFilter, severityFilter, categoryFilter, assignedToMe, searchText],
    queryFn: () => fetchIssues({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      categoryId: categoryFilter || undefined,
      assignedToMe: assignedToMe || undefined,
      search: searchText || undefined,
    }),
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['issue-categories'],
    queryFn: fetchCategories,
  });

  const items = issuesData?.items || [];

  // Translated filter options
  const statusOptions = React.useMemo(() => [
    { value: '', label: t('list.filters.allStatus') },
    { value: 'draft', label: t('list.status.draft') },
    { value: 'submitted', label: t('list.status.submitted') },
    { value: 'triaged', label: t('list.status.triaged') },
    { value: 'in_progress', label: t('list.status.inProgress') },
    { value: 'resolved', label: t('list.status.resolved') },
    { value: 'verified', label: t('list.status.verified') },
    { value: 'closed', label: t('list.status.closed') },
  ], [t]);

  const severityOptions = React.useMemo(() => [
    { value: '', label: t('list.filters.allSeverity') },
    { value: 'critical', label: t('list.severity.critical') },
    { value: 'major', label: t('list.severity.major') },
    { value: 'minor', label: t('list.severity.minor') },
  ], [t]);

  // Cell render functions
  const renderIssueNumber = (cellData: { data: Issue }) => {
    return (
      <Link
        href={`/issues/${cellData.data.id}`}
        className="font-mono text-blue-600 hover:underline"
      >
        {cellData.data.issueNumber}
      </Link>
    );
  };

  const renderTitle = (cellData: { data: Issue }) => {
    return (
      <Link
        href={`/issues/${cellData.data.id}`}
        className="text-gray-900 hover:text-blue-600 hover:underline"
      >
        {cellData.data.title}
      </Link>
    );
  };

  const renderStatus = (cellData: { data: Issue }) => {
    return <StatusBadge status={cellData.data.status} size="sm" />;
  };

  const renderSeverity = (cellData: { data: Issue }) => {
    return <SeverityBadge severity={cellData.data.severity} size="sm" />;
  };

  const renderPriority = (cellData: { data: Issue }) => {
    if (!cellData.data.priority) return <span className="text-gray-400">-</span>;
    return <PriorityBadge priority={cellData.data.priority} size="sm" />;
  };

  const renderCategory = (cellData: { data: Issue }) => {
    return cellData.data.category?.name || '-';
  };

  const renderAssignee = (cellData: { data: Issue }) => {
    return cellData.data.assignee?.name || '-';
  };

  const renderDate = (cellData: { data: Issue }) => {
    return new Date(cellData.data.createdAt).toLocaleDateString();
  };

  const renderActions = React.useCallback((cellData: { data: Issue }) => {
    return (
      <div className="flex items-center gap-1">
        <Button
          icon="search"
          hint={t('actions.viewDetails')}
          stylingMode="text"
          onClick={() => router.push(`/issues/${cellData.data.id}`)}
        />
      </div>
    );
  }, [router, t]);

  // Category options for filter
  const categoryOptions = React.useMemo(() => {
    const options = [{ id: 0, name: t('list.filters.allCategories') }];
    if (categories) {
      options.push(...categories.map(c => ({ id: c.id, name: c.name })));
    }
    return options;
  }, [categories, t]);

  return (
    <div className="p-4 md:p-6" data-testid="issues-list">
      <IssuesListPageHeader />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <TextBox
                placeholder={t('list.filters.searchPlaceholder')}
                value={searchText}
                onValueChanged={(e) => setSearchText(e.value || '')}
                showClearButton={true}
                mode="search"
                data-testid="search-input"
              />
            </div>

            <div className="w-40">
              <SelectBox
                key={`status-${locale}`}
                dataSource={statusOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                displayExpr="label"
                valueExpr="value"
                placeholder={t('list.filters.statusPlaceholder')}
                data-testid="status-filter"
              />
            </div>

            <div className="w-40">
              <SelectBox
                key={`severity-${locale}`}
                dataSource={severityOptions}
                value={severityFilter}
                onValueChanged={(e) => setSeverityFilter(e.value)}
                displayExpr="label"
                valueExpr="value"
                placeholder={t('list.filters.severityPlaceholder')}
                data-testid="severity-filter"
              />
            </div>

            <div className="w-48">
              <SelectBox
                key={`category-${locale}`}
                dataSource={categoryOptions}
                value={categoryFilter || 0}
                onValueChanged={(e) => setCategoryFilter(e.value === 0 ? null : e.value)}
                displayExpr="name"
                valueExpr="id"
                placeholder={t('list.filters.categoryPlaceholder')}
                data-testid="category-filter"
              />
            </div>

            <div>
              <Button
                text={assignedToMe ? t('list.filters.allIssues') : t('list.filters.assignedToMe')}
                type={assignedToMe ? 'default' : 'normal'}
                stylingMode={assignedToMe ? 'contained' : 'outlined'}
                onClick={() => setAssignedToMe(!assignedToMe)}
                data-testid="assigned-to-me-btn"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            key={locale}
            dataSource={items}
            keyExpr="id"
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            wordWrapEnabled={true}
            className="dx-card"
          >
            <LoadPanel enabled={isLoading || isFetching} />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Column
              dataField="issueNumber"
              caption={t('list.columns.issueNumber')}
              width={120}
              cellRender={renderIssueNumber}
            />
            <Column
              dataField="title"
              caption={t('list.columns.title')}
              minWidth={200}
              cellRender={renderTitle}
            />
            <Column
              dataField="status"
              caption={t('list.columns.status')}
              width={120}
              cellRender={renderStatus}
            />
            <Column
              dataField="severity"
              caption={t('list.columns.severity')}
              width={100}
              cellRender={renderSeverity}
            />
            <Column
              dataField="priority"
              caption={t('list.columns.priority')}
              width={120}
              cellRender={renderPriority}
            />
            <Column
              dataField="category.name"
              caption={t('list.columns.category')}
              width={140}
              cellRender={renderCategory}
            />
            <Column
              dataField="assignee.name"
              caption={t('list.columns.assignee')}
              width={140}
              cellRender={renderAssignee}
            />
            <Column
              dataField="createdAt"
              caption={t('list.columns.created')}
              width={110}
              dataType="date"
              cellRender={renderDate}
            />
            <Column
              caption={t('list.columns.actions')}
              width={80}
              cellRender={renderActions}
              allowSorting={false}
              allowFiltering={false}
            />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Results summary */}
      <div className="mt-4 text-sm text-gray-500">
        {t('list.summary', { shown: items.length, total: issuesData?.total || 0 })}
      </div>
    </div>
  );
}

export default function IssuesListPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <IssuesListContent />
    </Suspense>
  );
}

function LoadingFallback() {
  const t = useTranslations('issues');
  return <div className="p-8 text-center">{t('actions.loading')}</div>;
}
