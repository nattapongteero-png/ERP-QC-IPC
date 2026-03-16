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
import Link from 'next/link';
import {
  Bug,
  ArrowLeft,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  Selection,
  HeaderFilter,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, SeverityBadge, PriorityBadge } from '@/components/issues';
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
// Filter Options
// ============================================

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
];

const severityOptions = [
  { value: '', label: 'All Severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
];

// ============================================
// Page Header Component
// ============================================

function IssuesListPageHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Link href="/issues" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bug className="w-6 h-6" />
            Issues
          </h1>
          <p className="text-gray-600 mt-1">
            Browse, filter, and manage all reported issues
          </p>
        </div>
      </div>
      <Link href="/issues/new">
        <Button
          text="Report Issue"
          type="default"
          stylingMode="contained"
          icon="add"
          data-testid="new-issue-btn"
        />
      </Link>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

function IssuesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const renderActions = (cellData: { data: Issue }) => {
    return (
      <div className="flex items-center gap-1">
        <Button
          icon="search"
          hint="View Details"
          stylingMode="text"
          onClick={() => router.push(`/issues/${cellData.data.id}`)}
        />
      </div>
    );
  };

  // Category options for filter
  const categoryOptions = React.useMemo(() => {
    const options = [{ id: 0, name: 'All Categories' }];
    if (categories) {
      options.push(...categories.map(c => ({ id: c.id, name: c.name })));
    }
    return options;
  }, [categories]);

  return (
    <div className="p-6" data-testid="issues-list">
      <IssuesListPageHeader />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <TextBox
                placeholder="Search issues..."
                value={searchText}
                onValueChanged={(e) => setSearchText(e.value || '')}
                showClearButton={true}
                mode="search"
                data-testid="search-input"
              />
            </div>

            <div className="w-40">
              <SelectBox
                dataSource={statusOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                displayExpr="label"
                valueExpr="value"
                placeholder="Status"
                data-testid="status-filter"
              />
            </div>

            <div className="w-40">
              <SelectBox
                dataSource={severityOptions}
                value={severityFilter}
                onValueChanged={(e) => setSeverityFilter(e.value)}
                displayExpr="label"
                valueExpr="value"
                placeholder="Severity"
                data-testid="severity-filter"
              />
            </div>

            <div className="w-48">
              <SelectBox
                dataSource={categoryOptions}
                value={categoryFilter || 0}
                onValueChanged={(e) => setCategoryFilter(e.value === 0 ? null : e.value)}
                displayExpr="name"
                valueExpr="id"
                placeholder="Category"
                data-testid="category-filter"
              />
            </div>

            <div>
              <Button
                text={assignedToMe ? 'All Issues' : 'Assigned to Me'}
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
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Sorting mode="multiple" />
            <Selection mode="single" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Column
              dataField="issueNumber"
              caption="Issue #"
              width={120}
              cellRender={renderIssueNumber}
            />
            <Column
              dataField="title"
              caption="Title"
              minWidth={200}
              cellRender={renderTitle}
            />
            <Column
              dataField="status"
              caption="Status"
              width={120}
              cellRender={renderStatus}
            />
            <Column
              dataField="severity"
              caption="Severity"
              width={100}
              cellRender={renderSeverity}
            />
            <Column
              dataField="priority"
              caption="Priority"
              width={120}
              cellRender={renderPriority}
            />
            <Column
              dataField="category.name"
              caption="Category"
              width={140}
              cellRender={renderCategory}
            />
            <Column
              dataField="assignee.name"
              caption="Assignee"
              width={140}
              cellRender={renderAssignee}
            />
            <Column
              dataField="createdAt"
              caption="Created"
              width={110}
              dataType="date"
              cellRender={renderDate}
            />
            <Column
              caption="Actions"
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
        Showing {items.length} of {issuesData?.total || 0} issues
      </div>
    </div>
  );
}

export default function IssuesListPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <IssuesListContent />
    </Suspense>
  );
}
