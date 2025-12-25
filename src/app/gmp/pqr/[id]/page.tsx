'use client';

/**
 * PQR Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 * Task: T419
 *
 * Display full PQR report with metrics, KPI dashboard, recommendations,
 * and approval workflow.
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { PageHeader } from '@/components/ui/page-header';
import {
  FileBarChart,
  Package,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  TrendingUp,
  AlertCircle as AlertIcon,
  FlaskConical,
  ClipboardCheck,
  MessageSquare,
  BarChart3,
  Target,
  XCircle,
} from 'lucide-react';
import type { PqrReportWithMetrics, PqrStatus, MetricStatus } from '@/types/pqr';

// ============================================
// API Functions
// ============================================

async function fetchPqrReport(id: number): Promise<PqrReportWithMetrics> {
  const response = await fetch(`/api/pqr/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch PQR report');
  }
  return result.data;
}

async function updatePqrStatus(id: number, status: PqrStatus): Promise<void> {
  const response = await fetch(`/api/pqr/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update status');
  }
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusBadge(status: PqrStatus) {
  const colors: Record<PqrStatus, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    under_review: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const labels: Record<PqrStatus, string> = {
    draft: 'Draft',
    under_review: 'Under Review',
    approved: 'Approved',
  };
  const icons: Record<PqrStatus, React.ReactNode> = {
    draft: <Clock className="h-3.5 w-3.5" />,
    under_review: <AlertTriangle className="h-3.5 w-3.5" />,
    approved: <CheckCircle className="h-3.5 w-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${colors[status]}`}
    >
      {icons[status]}
      {labels[status]}
    </span>
  );
}

function getMetricStatusColor(status: MetricStatus): string {
  const colors: Record<MetricStatus, string> = {
    pass: 'text-emerald-600',
    warning: 'text-amber-600',
    fail: 'text-red-600',
  };
  return colors[status];
}

function getMetricStatusIcon(status: MetricStatus) {
  const icons: Record<MetricStatus, React.ReactNode> = {
    pass: <CheckCircle className="h-5 w-5 text-emerald-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    fail: <XCircle className="h-5 w-5 text-red-600" />,
  };
  return icons[status];
}

function getMetricTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    deviation_rate: 'Deviation Rate',
    capa_closure_rate: 'CAPA Closure Rate',
    oos_rate: 'OOS Rate',
    complaint_rate: 'Complaint Rate',
    recall_rate: 'Recall Rate',
    batch_success_rate: 'Batch Success Rate',
    yield_average: 'Average Yield',
    stability_compliance: 'Stability Compliance',
  };
  return labels[type] || type;
}

// ============================================
// Sub-Components
// ============================================

interface MetricCardProps {
  label: string;
  value: number | string;
  status?: MetricStatus;
  target?: number | null;
  icon: React.ReactNode;
  iconColor: string;
}

function MetricCard({ label, value, status, target, icon, iconColor }: MetricCardProps) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-opacity-10 ${iconColor}`}>{icon}</div>
        {status && getMetricStatusIcon(status)}
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${status ? getMetricStatusColor(status) : 'text-gray-900'}`}>
        {value}
      </p>
      {target !== null && target !== undefined && (
        <p className="text-xs text-gray-500 mt-1">Target: {target}</p>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function PqrDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const pqrId = Number(params.id);

  // State
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');

  // Fetch PQR report
  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['pqr', pqrId],
    queryFn: () => fetchPqrReport(pqrId),
    enabled: !!pqrId && !isNaN(pqrId),
  });

  // Status update mutations
  const submitForReviewMutation = useMutation({
    mutationFn: () => updatePqrStatus(pqrId, 'under_review'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pqr', pqrId] });
      queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
      queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => updatePqrStatus(pqrId, 'approved'),
    onSuccess: () => {
      setShowApproveDialog(false);
      setApprovalComments('');
      queryClient.invalidateQueries({ queryKey: ['pqr', pqrId] });
      queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
      queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
    },
  });

  // Handlers
  const handleSubmitForReview = useCallback(() => {
    if (!report) return;
    submitForReviewMutation.mutate();
  }, [report, submitForReviewMutation]);

  const handleApprove = useCallback(() => {
    approveMutation.mutate();
  }, [approveMutation]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !report) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <AlertIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-4">Failed to load PQR report</p>
          <DxButton text="Go Back" onClick={() => router.push('/gmp/pqr')} stylingMode="outlined" />
        </div>
      </div>
    );
  }

  // Determine available actions
  const canSubmitForReview = report.status === 'draft';
  const canApprove = report.status === 'under_review';
  const canEdit = report.status === 'draft';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={report.reportNumber}
        description={`${report.productCode} - ${report.productName} | Review Year: ${report.reviewYear}`}
        backButton={
          <DxButton
            text="Back to PQR Dashboard"
            icon="back"
            type="normal"
            stylingMode="text"
            onClick={() => router.push('/gmp/pqr')}
          />
        }
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <DxButton
                text="Edit"
                icon="edit"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push(`/gmp/pqr/${pqrId}/edit`)}
              />
            )}
            {canSubmitForReview && (
              <DxButton
                text="Submit for Review"
                icon="check"
                type="success"
                onClick={handleSubmitForReview}
                disabled={submitForReviewMutation.isPending}
              />
            )}
            {canApprove && (
              <DxButton
                text="Approve Report"
                icon="check"
                type="success"
                onClick={() => setShowApproveDialog(true)}
              />
            )}
          </div>
        }
      />

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        {getStatusBadge(report.status)}
        {report.approvedBy && report.approvedAt && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>
              Approved by {report.approvedByName} on {formatDate(report.approvedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Report Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card elevation="raised">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-indigo-600" />
                Report Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Product:</span>
                  <span className="font-medium">
                    {report.productCode} - {report.productName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Review Year:</span>
                  <span className="font-medium">{report.reviewYear}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Period:</span>
                  <span className="font-medium">
                    {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">{formatDate(report.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Production Metrics */}
          <Card elevation="raised">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Production Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Batches Produced"
                  value={report.batchesProduced}
                  icon={<Package className="h-5 w-5" />}
                  iconColor="text-blue-600"
                />
                <MetricCard
                  label="Deviations"
                  value={report.deviationCount}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  iconColor="text-amber-600"
                />
                <MetricCard
                  label="CAPAs"
                  value={report.capaCount}
                  icon={<ClipboardCheck className="h-5 w-5" />}
                  iconColor="text-purple-600"
                />
                <MetricCard
                  label="OOS Events"
                  value={report.oosCount}
                  icon={<FlaskConical className="h-5 w-5" />}
                  iconColor="text-red-600"
                />
                <MetricCard
                  label="Complaints"
                  value={report.complaintCount}
                  icon={<MessageSquare className="h-5 w-5" />}
                  iconColor="text-orange-600"
                />
                <MetricCard
                  label="Recalls"
                  value={report.recallCount}
                  icon={<XCircle className="h-5 w-5" />}
                  iconColor="text-red-700"
                />
              </div>
            </CardContent>
          </Card>

          {/* KPI Dashboard */}
          {report.metrics && report.metrics.length > 0 && (
            <Card elevation="raised">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-600" />
                  Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.metrics.map((metric) => (
                    <MetricCard
                      key={metric.id}
                      label={getMetricTypeLabel(metric.metricType)}
                      value={
                        metric.metricValue !== null
                          ? `${metric.metricValue.toFixed(2)}%`
                          : 'N/A'
                      }
                      status={metric.status}
                      target={metric.target}
                      icon={<TrendingUp className="h-5 w-5" />}
                      iconColor="text-indigo-600"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stability Status */}
          {report.stabilityStatus && (
            <Card elevation="raised">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-indigo-600" />
                  Stability Studies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{report.stabilityStatus}</p>
              </CardContent>
            </Card>
          )}

          {/* Conclusions */}
          {report.conclusions && (
            <Card elevation="raised">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  Conclusions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.conclusions}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {report.recommendations && (
            <Card elevation="raised">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">
                    {report.recommendations}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Overall Score */}
          {report.metrics && report.metrics.length > 0 && (
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardHeader>
                <CardTitle className="text-sm text-indigo-900">Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-indigo-600 mb-2">
                    {Math.round(
                      (report.metrics.filter((m) => m.status === 'pass').length /
                        report.metrics.length) *
                        100
                    )}
                    %
                  </div>
                  <p className="text-sm text-indigo-700">
                    {report.metrics.filter((m) => m.status === 'pass').length} of{' '}
                    {report.metrics.length} KPIs passed
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                      Pass
                    </span>
                    <span className="font-medium">
                      {report.metrics.filter((m) => m.status === 'pass').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Warning
                    </span>
                    <span className="font-medium">
                      {report.metrics.filter((m) => m.status === 'warning').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" />
                      Fail
                    </span>
                    <span className="font-medium">
                      {report.metrics.filter((m) => m.status === 'fail').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canEdit && (
                <DxButton
                  text="Edit Report"
                  icon="edit"
                  type="normal"
                  width="100%"
                  onClick={() => router.push(`/gmp/pqr/${pqrId}/edit`)}
                />
              )}
              {canSubmitForReview && (
                <DxButton
                  text="Submit for Review"
                  icon="check"
                  type="success"
                  width="100%"
                  onClick={handleSubmitForReview}
                  disabled={submitForReviewMutation.isPending}
                />
              )}
              {canApprove && (
                <DxButton
                  text="Approve Report"
                  icon="check"
                  type="success"
                  width="100%"
                  onClick={() => setShowApproveDialog(true)}
                />
              )}
              <DxButton
                text="Export PDF"
                icon="export"
                type="normal"
                stylingMode="outlined"
                width="100%"
                onClick={() => window.print()}
              />
            </CardContent>
          </Card>

          {/* Approval History */}
          {report.approvedBy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Approval History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {report.approvedByName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Approved on {formatDate(report.approvedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">About This Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-gray-600">
                <p>
                  This PQR report provides a comprehensive annual quality review for the selected
                  product.
                </p>
                <p>
                  <strong>KPI Status:</strong>
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>
                    <span className="text-emerald-600 font-medium">Pass:</span> Meets target
                  </li>
                  <li>
                    <span className="text-amber-600 font-medium">Warning:</span> Close to limit
                  </li>
                  <li>
                    <span className="text-red-600 font-medium">Fail:</span> Exceeds limit
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval Dialog */}
      <DxPopup
        visible={showApproveDialog}
        onHiding={() => setShowApproveDialog(false)}
        title="Approve PQR Report"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800">
                You are about to approve this PQR report
              </p>
            </div>
            <p className="text-sm text-green-700 mt-2">
              Report Number: {report.reportNumber}
            </p>
            <p className="text-sm text-green-700">
              Product: {report.productCode} - {report.productName}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Comments (Optional)</label>
            <DxTextArea
              value={approvalComments}
              onValueChange={(value) => setApprovalComments(value || '')}
              placeholder="Add any approval comments..."
              height={100}
            />
          </div>

          {approveMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {approveMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowApproveDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Approve Report"
              icon="check"
              onClick={handleApprove}
              type="success"
              disabled={approveMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
