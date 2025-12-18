'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertOctagon,
} from 'lucide-react';

interface Deviation {
  id: number;
  deviationNumber: string;
  title: string;
  description: string;
  sourceType: string;
  sourceId: number;
  severity: string;
  status: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  reportedBy: number;
  assignedTo: number;
  dueDate: string;
  closedBy: number;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const severityOptions = [
  { value: '', label: 'All Severities' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
];

export default function DeviationsPage() {
  const router = useRouter();
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchDeviations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);

      const res = await fetch(`/api/quality/deviations?${params}`);
      const data = await res.json();

      if (data.success) {
        setDeviations(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      } else {
        console.error('API error:', data.error);
        setDeviations([]);
      }
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
      setDeviations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviations();
  }, [pagination.page, statusFilter, severityFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchDeviations();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (!dueDate || status === 'closed' || status === 'resolved') return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'success' | 'warning' | 'secondary' | 'default' => {
    switch (status) {
      case 'closed':
        return 'primary';
      case 'resolved':
        return 'success';
      case 'investigating':
        return 'warning';
      case 'open':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSeverityBadgeVariant = (severity: string): 'danger' | 'warning' | 'default' => {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'major':
        return 'warning';
      case 'minor':
      default:
        return 'default';
    }
  };

  const getSourceTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      production: 'Production',
      quality: 'Quality',
      warehouse: 'Warehouse',
    };
    return labels[type] || type || '-';
  };

  const columns = [
    {
      key: 'deviationNumber',
      header: 'Deviation #',
      render: (dev: Deviation) => (
        <div>
          <p className="font-medium">{dev.deviationNumber}</p>
          {isOverdue(dev.dueDate, dev.status) && (
            <Badge variant="danger" size="sm">
              Overdue
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (dev: Deviation) => (
        <div className="max-w-xs">
          <p className="font-medium truncate">{dev.title}</p>
          <p className="text-sm text-gray-500 truncate">{dev.description}</p>
        </div>
      ),
    },
    {
      key: 'sourceType',
      header: 'Source',
      render: (dev: Deviation) => getSourceTypeLabel(dev.sourceType),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (dev: Deviation) => (
        <Badge variant={getSeverityBadgeVariant(dev.severity)}>
          {dev.severity}
        </Badge>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (dev: Deviation) => (
        <span className={isOverdue(dev.dueDate, dev.status) ? 'text-red-600 font-medium' : ''}>
          {formatDate(dev.dueDate)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (dev: Deviation) => (
        <Badge variant={getStatusBadgeVariant(dev.status)} dot>
          {dev.status}
        </Badge>
      ),
    },
  ];

  // Calculate summary stats
  const openCount = deviations.filter((d) => d.status === 'open').length;
  const investigatingCount = deviations.filter((d) => d.status === 'investigating').length;
  const criticalCount = deviations.filter((d) => d.severity === 'critical' && d.status !== 'closed').length;
  const overdueCount = deviations.filter((d) => isOverdue(d.dueDate, d.status)).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Deviations"
          description="Track and manage quality deviations and CAPA"
          actions={
            <Button
              onClick={() => router.push('/quality/deviations/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Report Deviation
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Open</p>
                  <p className="text-xl font-bold">{openCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Investigating</p>
                  <p className="text-xl font-bold text-yellow-600">{investigatingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Critical</p>
                  <p className="text-xl font-bold text-red-600">{criticalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Overdue</p>
                  <p className="text-xl font-bold text-orange-600">{overdueCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Alert */}
        {criticalCount > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertOctagon className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">
                    {criticalCount} Critical Deviation{criticalCount > 1 ? 's' : ''} Require Attention
                  </p>
                  <p className="text-sm text-red-600">
                    Critical deviations may impact product safety or efficacy. Please address immediately.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card elevation="raised">
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by deviation number or title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>
              <div className="w-full md:w-40">
                <Select
                  options={severityOptions}
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : deviations.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={deviations}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No deviations found"
                  striped
                  hoverable
                  onRowClick={(dev) => router.push(`/quality/deviations/${dev.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} deviations
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page * pagination.limit >= pagination.total}
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<AlertTriangle className="h-8 w-8" />}
                title="No deviations found"
                description="Report a new deviation when quality issues are identified"
                action={{
                  label: 'Report Deviation',
                  onClick: () => router.push('/quality/deviations/new'),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
