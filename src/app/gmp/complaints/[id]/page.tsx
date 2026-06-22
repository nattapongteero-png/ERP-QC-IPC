'use client';

/**
 * Complaint Detail Page - Professional Redesign
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Comprehensive complaint management with DevExtreme UI components
 */

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ComplaintDataEntryDialog, ComplaintInvestigationForm } from '@/components/complaints';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { StatusStepper } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DocumentAttachment } from '@/components/ui/document-attachment';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import {
  MessageSquareWarning,
  CheckCircle,
  User,
  AlertTriangle,
  Package,
  Phone,
  FileText,
  Link2,
  Calendar,
  Clock,
  XCircle,
  CircleDot,
  Search,
  ClipboardCheck,
  ShieldAlert,
  Activity,
  ArrowLeft,
  Building,
  Paperclip,
  AlertCircle,
  Eye,
  Gauge,
  TrendingUp,
} from 'lucide-react';
import type {
  ComplaintDetails,
  ComplaintSeverity,
  ComplaintStatus,
  ComplaintSource,
  ComplaintCategory,
} from '@/types/complaints';

// ============================================
// API Functions
// ============================================

async function fetchComplaintDetails(id: number): Promise<ComplaintDetails> {
  const response = await fetch(`/api/complaints/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch complaint');
  }
  return result.data;
}

async function closeComplaint(id: number, closureNotes?: string): Promise<void> {
  const response = await fetch(`/api/complaints/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closureNotes }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to close complaint');
  }
}

async function deleteComplaint(id: number): Promise<void> {
  const response = await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to delete complaint');
  }
}

// ============================================
// Configuration
// ============================================

const SEVERITY_CONFIG: Record<ComplaintSeverity, {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  minor: {
    label: 'Minor',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-500',
  },
  major: {
    label: 'Major',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-500',
  },
  critical: {
    label: 'Critical',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-red-500',
  },
};

const STATUS_CONFIG: Record<ComplaintStatus, {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  step: number;
}> = {
  received: {
    label: 'Received',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: CircleDot,
    step: 1,
  },
  under_investigation: {
    label: 'Under Investigation',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Search,
    step: 2,
  },
  resolved: {
    label: 'Resolved',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: ClipboardCheck,
    step: 3,
  },
  closed: {
    label: 'Closed',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: CheckCircle,
    step: 4,
  },
};

const SOURCE_CONFIG: Record<ComplaintSource, { label: string }> = {
  customer: { label: 'Customer' },
  distributor: { label: 'Distributor' },
  regulatory: { label: 'Regulatory' },
  internal: { label: 'Internal' },
};

const CATEGORY_CONFIG: Record<ComplaintCategory, { label: string; color: string }> = {
  quality: { label: 'Quality', color: '#3b82f6' },
  efficacy: { label: 'Efficacy', color: '#8b5cf6' },
  safety: { label: 'Safety', color: '#ef4444' },
  packaging: { label: 'Packaging', color: '#f59e0b' },
  labeling: { label: 'Labeling', color: '#06b6d4' },
  other: { label: 'Other', color: '#6b7280' },
};

const TAB_IDS = {
  overview: 0,
  investigation: 1,
  attachments: 2,
} as const;

// ============================================
// Helper Functions
// ============================================

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// Component
// ============================================

export default function ComplaintDetailPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const params = useParams();
  const queryClient = useQueryClient();
  const complaintId = Number(params.id);

  // State
  const [activeTab, setActiveTab] = useState<number>(TAB_IDS.overview);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');

  // Fetch complaint details
  const {
    data: complaint,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['complaint', complaintId],
    queryFn: () => fetchComplaintDetails(complaintId),
    enabled: !!complaintId && !isNaN(complaintId),
  });

  // Close complaint mutation
  const closeMutation = useMutation({
    mutationFn: () => closeComplaint(complaintId, closureNotes),
    onSuccess: () => {
      setShowCloseDialog(false);
      setClosureNotes('');
      queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
      queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
    },
  });

  // Delete complaint mutation (only allowed while status === 'received')
  const deleteMutation = useMutation({
    mutationFn: () => deleteComplaint(complaintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
      router.push('/gmp/complaints');
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : t('complaints.detail.deleteFailed'));
    },
  });

  const handleDeleteComplaint = () => {
    if (!window.confirm(t('complaints.detail.deleteConfirm'))) {
      return;
    }
    deleteMutation.mutate();
  };

  // Tabs configuration
  const tabs: DxTabItem[] = useMemo(() => [
    { id: TAB_IDS.overview, text: t('complaints.detail.tabs.overview'), icon: 'home' },
    { id: TAB_IDS.investigation, text: t('complaints.detail.tabs.investigation'), icon: 'search' },
    { id: TAB_IDS.attachments, text: t('complaints.detail.tabs.attachments'), icon: 'attach' },
  ], [t]);

  // Computed values
  const statusConfig = complaint ? STATUS_CONFIG[complaint.status] : null;
  const severityConfig = complaint ? SEVERITY_CONFIG[complaint.severity] : null;
  const categoryConfig = complaint ? CATEGORY_CONFIG[complaint.category] : null;
  const sourceConfig = complaint ? SOURCE_CONFIG[complaint.source] : null;
  const canClose = complaint?.status === 'resolved';
  const canDelete = complaint?.status === 'received';
  const isOpen = complaint?.status !== 'closed';
  const hasInvestigation = !!complaint?.investigation;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <DxLoadIndicator height={60} width={60} />
          <p className="mt-4 text-gray-500">{t('complaints.detail.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">{t('complaints.title')} - {t('common.error')}</h2>
            <p className="text-gray-500 mb-6">{error?.message || t('complaints.detail.notFound')}</p>
            <div className="flex gap-3 justify-center">
              <DxButton
                text={t('common.goBack')}
                icon="back"
                onClick={() => router.back()}
                stylingMode="outlined"
              />
              <DxButton
                text={t('common.retry')}
                icon="refresh"
                onClick={() => refetch()}
                type="default"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Professional Header with Gradient */}
      <div className={cn(
        'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700',
        'text-white shadow-lg'
      )}>
        <div className="container mx-auto px-4 py-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/gmp/complaints')}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t('complaints.detail.backToList')}</span>
            </button>
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                hint={t('common.refresh')}
                onClick={() => refetch()}
                stylingMode="text"
                className="text-white"
              />
              <DxButton
                icon="print"
                hint={t('complaints.detail.print')}
                onClick={() => window.print()}
                stylingMode="text"
                className="text-white"
              />
              {canDelete && (
                <DxButton
                  icon="trash"
                  text={t('complaints.detail.delete')}
                  hint={t('complaints.detail.deleteHint')}
                  onClick={handleDeleteComplaint}
                  disabled={deleteMutation.isPending}
                  stylingMode="text"
                  className="text-white"
                  elementAttr={{ 'data-testid': 'complaint-delete-btn' }}
                />
              )}
            </div>
          </div>

          {/* Main Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <MessageSquareWarning className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">
                    {t('complaints.detail.heading', { number: complaint.complaintNumber })}
                  </h1>
                  <p className="text-white/80 text-lg">{complaint.productName || t('complaints.detail.unknownProduct')}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {/* Status Badge */}
                {statusConfig && (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                    'bg-white/20 backdrop-blur-sm'
                  )}>
                    <statusConfig.icon className="h-4 w-4" />
                    {t(`complaints.status.${complaint.status}`)}
                  </span>
                )}

                {/* Severity Badge */}
                {severityConfig && (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                    severityConfig.bgClass,
                    severityConfig.textClass
                  )}>
                    <AlertCircle className="h-4 w-4" />
                    {t(`complaints.severity.${complaint.severity}`)}
                  </span>
                )}

                {/* Category Badge */}
                {categoryConfig && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                    <FileText className="h-4 w-4" />
                    {t(`complaints.categories.${complaint.category}`)}
                  </span>
                )}

                {/* Regulatory Warning */}
                {complaint.regulatoryReportRequired && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-500 text-white">
                    <ShieldAlert className="h-4 w-4" />
                    {t('complaints.detail.regulatoryRequired')}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isOpen && (
                <DxButton
                  text={t('complaints.detail.edit')}
                  icon="edit"
                  onClick={() => setShowEditDialog(true)}
                  stylingMode="outlined"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                />
              )}
              {!complaint.capaId && (
                <DxButton
                  text={t('complaints.detail.createCapa')}
                  icon="plus"
                  onClick={() =>
                    router.push(
                      `/gmp/capa/new?complaintId=${complaint.id}&complaintNumber=${encodeURIComponent(complaint.complaintNumber)}`
                    )
                  }
                  stylingMode="outlined"
                  elementAttr={{ 'data-testid': 'create-capa-from-complaint' }}
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                />
              )}
              {canClose && (
                <DxButton
                  text={t('complaints.detail.closeComplaint')}
                  icon="check"
                  onClick={() => setShowCloseDialog(true)}
                  type="success"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow status — สถานะการดำเนินงาน */}
      <div className="container mx-auto px-4 mt-6">
        <StatusStepper
          title={t('complaints.detail.workflowTitle')}
          current={complaint.status}
          steps={[
            { key: 'received', label: t('complaints.detail.steps.received') },
            { key: 'under_investigation', label: t('complaints.detail.steps.under_investigation') },
            { key: 'resolved', label: t('complaints.detail.steps.resolved') },
            { key: 'closed', label: t('complaints.detail.steps.closed') },
          ]}
        />
      </div>

      {/* Key Metrics Cards */}
      <div className="container mx-auto px-4 mt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Severity */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-3 rounded-xl', severityConfig?.bgClass || 'bg-gray-100')}>
                  <Gauge className={cn('h-6 w-6', severityConfig?.textClass || 'text-gray-600')} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('complaints.detail.metrics.severity')}</p>
                  <p className={cn('text-lg font-semibold', severityConfig?.textClass || 'text-gray-900')}>
                    {complaint ? t(`complaints.severity.${complaint.severity}`) : '-'}
                  </p>
                  <p className="text-xs text-gray-400">{severityConfig?.label || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('complaints.detail.metrics.category')}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {complaint ? t(`complaints.categories.${complaint.category}`) : '-'}
                  </p>
                  <p className="text-xs text-gray-400">{categoryConfig?.label || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-violet-100">
                  <Building className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('complaints.detail.metrics.source')}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {complaint ? t(`complaints.detail.source.${complaint.source}`) : '-'}
                  </p>
                  <p className="text-xs text-gray-400">{sourceConfig?.label || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investigation Status */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  hasInvestigation ? 'bg-green-100' : 'bg-gray-100'
                )}>
                  <Search className={cn(
                    'h-6 w-6',
                    hasInvestigation ? 'text-green-600' : 'text-gray-400'
                  )} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('complaints.detail.metrics.investigation')}</p>
                  <p className={cn(
                    'text-lg font-semibold',
                    hasInvestigation ? 'text-green-600' : 'text-gray-500'
                  )}>
                    {complaint.investigation?.completionDate ? t('complaints.detail.investigationState.completed') :
                     hasInvestigation ? t('complaints.detail.investigationState.inProgress') : t('complaints.detail.investigationState.pending')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {complaint.investigation?.investigatorName || t('complaints.detail.notAssigned')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Regulatory Warning Banner */}
      {complaint.regulatoryReportRequired && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  {t('complaints.detail.regulatoryBanner.title')}
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {complaint.regulatoryReportDate
                    ? t('complaints.detail.regulatoryBanner.reportedOn', { date: formatDate(complaint.regulatoryReportDate) })
                    : t('complaints.detail.regulatoryBanner.notReported')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="container mx-auto px-4 mt-6">
        <Card className="shadow-lg border-0 overflow-hidden">
          <DxTabs
            items={tabs}
            selectedIndex={activeTab}
            onSelectedIndexChange={setActiveTab}
            showNavButtons
          />

          <CardContent className="p-6">
            {/* Overview Tab */}
            {activeTab === TAB_IDS.overview && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-600" />
                    {t('complaints.detail.sections.generalInfo')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('complaints.detail.fields.complaintNumber')}</span>
                      <span className="font-mono font-medium">{complaint.complaintNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('complaints.detail.fields.receivedDate')}</span>
                      <span className="font-medium">{formatDate(complaint.receivedDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('complaints.detail.fields.product')}</span>
                      <span className="font-medium">{complaint.productName || '-'}</span>
                    </div>
                    {complaint.lotNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('complaints.detail.fields.lotNumber')}</span>
                        <span className="font-mono">{complaint.lotNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('complaints.detail.fields.createdBy')}</span>
                      <span className="font-medium">{complaint.createdByName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('complaints.detail.fields.createdAt')}</span>
                      <span className="font-medium">{formatDateTime(complaint.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-orange-600" />
                    {t('complaints.detail.sections.complainantInfo')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('complaints.detail.metrics.source')}</span>
                      <span className="font-medium">{t(`complaints.detail.source.${complaint.source}`)}</span>
                    </div>
                    {complaint.customerName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('complaints.detail.fields.name')}</span>
                        <span className="font-medium">{complaint.customerName}</span>
                      </div>
                    )}
                    {complaint.customerContact && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('complaints.detail.fields.contact')}</span>
                        <span className="font-medium">{complaint.customerContact}</span>
                      </div>
                    )}
                    {!complaint.customerName && !complaint.customerContact && (
                      <p className="text-gray-400 italic">{t('complaints.detail.noComplainantInfo')}</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    {t('complaints.detail.sections.description')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {complaint.description}
                    </p>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-orange-600" />
                    {t('complaints.detail.workflowTitle')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between overflow-x-auto pb-2">
                      {Object.entries(STATUS_CONFIG)
                        .sort(([, a], [, b]) => a.step - b.step)
                        .map(([key, config], index, arr) => {
                          const isActive = key === complaint.status;
                          const isPassed = config.step < STATUS_CONFIG[complaint.status].step;
                          const Icon = config.icon;

                          return (
                            <div key={key} className="flex items-center flex-1">
                              <div className="flex flex-col items-center min-w-[80px]">
                                <div className={cn(
                                  'w-10 h-10 rounded-full flex items-center justify-center',
                                  isActive ? 'bg-orange-500 text-white' :
                                  isPassed ? 'bg-green-500 text-white' :
                                  'bg-gray-200 text-gray-400'
                                )}>
                                  {isPassed ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className={cn(
                                  'text-xs mt-2 text-center',
                                  isActive ? 'text-orange-600 font-semibold' :
                                  isPassed ? 'text-green-600' :
                                  'text-gray-400'
                                )}>
                                  {t(`complaints.status.${key}`)}
                                </span>
                              </div>
                              {index < arr.length - 1 && (
                                <div className={cn(
                                  'flex-1 h-1 mx-2',
                                  isPassed ? 'bg-green-500' : 'bg-gray-200'
                                )} />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Linked Records */}
                {(complaint.capaId || complaint.recallId) && (
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Link2 className="h-5 w-5 text-orange-600" />
                      {t('complaints.detail.sections.linkedRecords')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {complaint.capaId && complaint.capa && (
                        <button
                          onClick={() => router.push(`/gmp/capa/${complaint.capaId}`)}
                          className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
                        >
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <ClipboardCheck className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-blue-800 dark:text-blue-200">
                              CAPA: {(complaint.capa as { capaNumber?: string }).capaNumber}
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-300 truncate">
                              {(complaint.capa as { title?: string }).title}
                            </p>
                          </div>
                        </button>
                      )}

                      {complaint.recallId && complaint.recall && (
                        <button
                          onClick={() => router.push(`/gmp/recalls/${complaint.recallId}`)}
                          className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left"
                        >
                          <div className="p-2 bg-red-100 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-200">
                              Recall: {(complaint.recall as { recallNumber?: string }).recallNumber}
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-300 truncate">
                              {(complaint.recall as { reason?: string }).reason}
                            </p>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Closure Information */}
                {complaint.closedDate && (
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      {t('complaints.detail.sections.closureInfo')}
                    </h3>

                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">{t('complaints.detail.fields.closedDate')}</span>
                          <p className="font-medium text-green-700 dark:text-green-300">
                            {formatDate(complaint.closedDate)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">{t('complaints.detail.fields.closedBy')}</span>
                          <p className="font-medium text-green-700 dark:text-green-300">
                            {complaint.closedByName || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Investigation Tab */}
            {activeTab === TAB_IDS.investigation && (
              <div className="max-w-2xl mx-auto">
                <ComplaintInvestigationForm
                  complaint={complaint}
                  onInvestigationStarted={() => refetch()}
                  onInvestigationRecorded={() => refetch()}
                />
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === TAB_IDS.attachments && (
              <DocumentAttachment
                moduleName="complaint"
                entityId={complaintId}
                title={t('complaints.detail.attachmentsTitle')}
                categories={['evidence', 'report', 'photo', 'investigation', 'lab_result', 'other']}
                readOnly={complaint.status === 'closed'}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Complaint Dialog */}
      <ComplaintDataEntryDialog
        visible={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSaved={() => {
          setShowEditDialog(false);
          refetch();
        }}
        complaint={complaint}
        mode="edit"
      />

      {/* Close Complaint Dialog */}
      <DxPopup
        visible={showCloseDialog}
        onHiding={() => setShowCloseDialog(false)}
        title={t('complaints.detail.closeComplaint')}
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  {t('complaints.detail.closeDialog.investigationDone')}
                </p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  {t('complaints.detail.closeDialog.readyToClose')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('complaints.detail.closeDialog.notesLabel')}</label>
            <DxTextArea
              value={closureNotes}
              onValueChange={(value) => setClosureNotes(value || '')}
              placeholder={t('complaints.detail.closeDialog.notesPlaceholder')}
              height={100}
            />
          </div>

          {closeMutation.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {closeMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text={t('common.cancel')}
              onClick={() => setShowCloseDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text={t('complaints.detail.closeComplaint')}
              icon="check"
              onClick={() => closeMutation.mutate()}
              type="success"
              disabled={closeMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
