'use client';

/**
 * CAPA Detail Page - Professional Redesign
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Comprehensive CAPA management with DevExtreme UI components
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CapaActionList, CapaEffectivenessForm, CapaDataEntryDialog } from '@/components/capa';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { StatusStepper } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItemData } from '@/components/ui/dx-tabs';
import { DxDataGrid, DxColumn } from '@/components/ui/dx-data-grid';
import type { DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DocumentAttachment } from '@/components/ui/document-attachment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import PieChart, { Series, Legend, Tooltip, Label } from 'devextreme-react/pie-chart';
import {
  FileCheck,
  CheckCircle,
  User,
  Calendar,
  AlertTriangle,
  Target,
  FileText,
  Shield,
  Activity,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Printer,
  Edit,
  XCircle,
  ChevronRight,
  ListChecks,
  ClipboardCheck,
  Paperclip,
  Users,
  Package,
  Building,
  Scale,
  Gauge,
  CircleDot,
  ArrowLeft,
  Download,
  Eye,
} from 'lucide-react';
import type {
  CapaDetails,
  CapaPriority,
  CapaStatus,
  CapaAction,
  CapaEffectiveness,
  CapaApproval,
  RiskSeverity,
  RiskProbability,
} from '@/types/capa';

// ============================================
// API Functions
// ============================================

async function fetchCapaDetails(id: number): Promise<CapaDetails> {
  const response = await fetch(`/api/capa/${id}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch CAPA');
  }
  return result.data;
}

async function closeCapa(id: number, closureNotes?: string): Promise<void> {
  const response = await fetch(`/api/capa/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closureNotes }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to close CAPA');
  }
}

// ============================================
// Configuration
// ============================================

// labelKey holds the i18n key (relative to the 'gmp' namespace) resolved via t() at call sites.
const PRIORITY_CONFIG: Record<CapaPriority, {
  labelKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  low: {
    labelKey: 'capa.priority.low',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-500',
  },
  medium: {
    labelKey: 'capa.priority.medium',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-500',
  },
  high: {
    labelKey: 'capa.priority.high',
    color: '#f97316',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-500',
  },
  critical: {
    labelKey: 'capa.priority.critical',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-red-500',
  },
};

const STATUS_CONFIG: Record<CapaStatus, {
  labelKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  step: number;
}> = {
  open: {
    labelKey: 'capa.detail.workflowStatus.open',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: CircleDot,
    step: 1,
  },
  investigation: {
    labelKey: 'capa.detail.workflowStatus.investigation',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Eye,
    step: 2,
  },
  action_pending: {
    labelKey: 'capa.detail.workflowStatus.actionPending',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    icon: Clock,
    step: 3,
  },
  verification: {
    labelKey: 'capa.detail.workflowStatus.verification',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: ClipboardCheck,
    step: 4,
  },
  pending_approval: {
    labelKey: 'capa.detail.workflowStatus.pendingApproval',
    color: '#ec4899',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    icon: Users,
    step: 5,
  },
  closed: {
    labelKey: 'capa.detail.workflowStatus.closed',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: CheckCircle,
    step: 6,
  },
  cancelled: {
    labelKey: 'capa.detail.workflowStatus.cancelled',
    color: '#6b7280',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    icon: XCircle,
    step: 0,
  },
};

const RISK_SEVERITY_LABELS: Record<RiskSeverity, { labelKey: string; value: number }> = {
  negligible: { labelKey: 'capa.detail.severity.negligible', value: 1 },
  minor: { labelKey: 'capa.detail.severity.minor', value: 2 },
  moderate: { labelKey: 'capa.detail.severity.moderate', value: 3 },
  major: { labelKey: 'capa.detail.severity.major', value: 4 },
  critical: { labelKey: 'capa.detail.severity.critical', value: 5 },
};

const RISK_PROBABILITY_LABELS: Record<RiskProbability, { labelKey: string; value: number }> = {
  rare: { labelKey: 'capa.detail.probability.rare', value: 1 },
  unlikely: { labelKey: 'capa.detail.probability.unlikely', value: 2 },
  possible: { labelKey: 'capa.detail.probability.possible', value: 3 },
  likely: { labelKey: 'capa.detail.probability.likely', value: 4 },
  certain: { labelKey: 'capa.detail.probability.certain', value: 5 },
};

const ROOT_CAUSE_CATEGORIES: Record<string, { labelKey: string; color: string }> = {
  man: { labelKey: 'capa.detail.rootCauseCategories.man', color: '#3b82f6' },
  machine: { labelKey: 'capa.detail.rootCauseCategories.machine', color: '#8b5cf6' },
  method: { labelKey: 'capa.detail.rootCauseCategories.method', color: '#22c55e' },
  material: { labelKey: 'capa.detail.rootCauseCategories.material', color: '#f59e0b' },
  measurement: { labelKey: 'capa.detail.rootCauseCategories.measurement', color: '#06b6d4' },
  environment: { labelKey: 'capa.detail.rootCauseCategories.environment', color: '#ec4899' },
};

type TabKey = 'overview' | 'actions' | 'effectiveness' | 'risk' | 'attachments' | 'approvals';

// Map tab index to TabKey
const TAB_KEYS: TabKey[] = ['overview', 'actions', 'effectiveness', 'risk', 'attachments', 'approvals'];

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

const getRiskColor = (score: number | null | undefined): string => {
  if (!score) return '#6b7280';
  if (score <= 4) return '#22c55e'; // Low - green
  if (score <= 9) return '#f59e0b'; // Medium - amber
  if (score <= 16) return '#f97316'; // High - orange
  return '#ef4444'; // Critical - red
};

const getRiskLevel = (score: number | null | undefined): string => {
  if (!score) return 'N/A';
  if (score <= 4) return 'Low';
  if (score <= 9) return 'Medium';
  if (score <= 16) return 'High';
  return 'Critical';
};

// ============================================
// Component
// ============================================

export default function CapaDetailPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const params = useParams();
  const queryClient = useQueryClient();
  const capaId = Number(params.id);

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Delete a mistaken / test CAPA (only allowed while status === 'open').
  const handleDeleteCapa = useCallback(async () => {
    if (!window.confirm(t('capa.detail.deleteConfirm'))) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/capa/${capaId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || t('capa.detail.deleteFailed'));
      }
      router.push('/gmp/capa');
    } catch (err) {
      alert(err instanceof Error ? err.message : t('capa.detail.deleteFailed'));
      setDeleting(false);
    }
  }, [capaId, router, t]);

  // Fetch CAPA details
  const {
    data: capa,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['capa', capaId],
    queryFn: () => fetchCapaDetails(capaId),
    enabled: !!capaId && !isNaN(capaId),
  });

  // Close CAPA mutation
  const closeMutation = useMutation({
    mutationFn: () => closeCapa(capaId, closureNotes),
    onSuccess: () => {
      setShowCloseDialog(false);
      setClosureNotes('');
      queryClient.invalidateQueries({ queryKey: ['capa', capaId] });
      queryClient.invalidateQueries({ queryKey: ['capa-dashboard'] });
    },
  });

  // Tabs configuration - using numeric IDs as required by DxTabItemData
  // 0: overview, 1: actions, 2: effectiveness, 3: risk, 4: attachments, 5: approvals
  const tabs: DxTabItemData[] = useMemo(() => [
    { id: 0, text: t('capa.detail.tabs.overview'), icon: 'home' },
    { id: 1, text: `${t('capa.detail.tabs.actions')} (${capa?.actions?.length || 0})`, icon: 'checklist' },
    { id: 2, text: `${t('capa.detail.tabs.effectiveness')} (${capa?.effectivenessChecks?.length || 0})`, icon: 'chart' },
    { id: 3, text: t('capa.detail.tabs.riskAssessment'), icon: 'warning' },
    { id: 4, text: t('capa.detail.tabs.attachments'), icon: 'attach' },
    { id: 5, text: `${t('capa.detail.tabs.approvals')} (${capa?.approvals?.length || 0})`, icon: 'user' },
  ], [capa, t]);

  // Computed values
  const statusConfig = capa ? STATUS_CONFIG[capa.status] : null;
  const priorityConfig = capa ? PRIORITY_CONFIG[capa.priority] : null;
  const canClose = capa && capa.status !== 'closed' && capa.status !== 'cancelled';
  const hasActions = (capa?.actions?.length ?? 0) > 0;
  const allActionsComplete = hasActions && (capa?.actions?.every((a) => a.status === 'completed') ?? false);
  const hasEffectiveCheck = capa?.effectivenessChecks?.some((e) => e.result === 'effective') ?? false;
  const hasRiskAssessment = !!(capa?.riskSeverity && capa?.riskProbability);
  const hasRootCause = !!(capa?.rootCauseAnalysis && capa.rootCauseAnalysis.trim() !== '');
  const canCloseNow = canClose && allActionsComplete && hasEffectiveCheck && hasRiskAssessment && hasRootCause;

  // Closure checklist for display
  const closureChecklist = capa ? [
    { label: t('capa.detail.closure.actionLabel'), ok: allActionsComplete, detail: hasActions ? `${capa.actions.filter((a) => a.status === 'completed').length}/${capa.actions.length} ${t('capa.detail.closure.done')}` : t('capa.detail.closure.noItems') },
    { label: t('capa.detail.closure.effectivenessLabel'), ok: hasEffectiveCheck, detail: hasEffectiveCheck ? t('capa.detail.closure.passed') : t('capa.detail.closure.noEffectiveResult') },
    { label: t('capa.detail.closure.riskLabel'), ok: hasRiskAssessment, detail: hasRiskAssessment ? `${capa.riskSeverity}/${capa.riskProbability}` : t('capa.detail.closure.notAssessed') },
    { label: t('capa.detail.closure.rootCauseLabel'), ok: hasRootCause, detail: hasRootCause ? t('capa.detail.closure.specified') : t('capa.detail.closure.notSpecified') },
  ] : [];
  const completedActions = capa?.actions?.filter((a) => a.status === 'completed').length ?? 0;
  const totalActions = capa?.actions?.length ?? 0;
  const actionProgress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <DxLoadIndicator height={60} width={60} />
          <p className="mt-4 text-gray-500">{t('capa.detail.loadingDetails')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !capa) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">{t('capa.title')} - {t('common.error')}</h2>
            <p className="text-gray-500 mb-6">{error?.message || t('capa.detail.notFound')}</p>
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
              onClick={() => router.push('/gmp/capa')}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t('capa.detail.backToList')}</span>
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
                hint={t('capa.detail.print')}
                onClick={() => window.print()}
                stylingMode="text"
                className="text-white"
              />
            </div>
          </div>

          {/* Main Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <FileCheck className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">{capa.title}</h1>
                  <p className="text-white/80 font-mono text-lg">{capa.capaNumber}</p>
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
                    {t(statusConfig.labelKey)}
                  </span>
                )}

                {/* Priority Badge */}
                {priorityConfig && (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                    priorityConfig.bgClass,
                    priorityConfig.textClass
                  )}>
                    <AlertCircle className="h-4 w-4" />
                    {t(priorityConfig.labelKey)}
                  </span>
                )}

                {/* Type Badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                  <Target className="h-4 w-4" />
                  {capa.type === 'corrective' ? t('capa.detail.type.corrective') : capa.type === 'preventive' ? t('capa.detail.type.preventive') : t('capa.detail.type.both')}
                </span>

                {/* Overdue Warning */}
                {capa.isOverdue && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-500 text-white">
                    <AlertTriangle className="h-4 w-4" />
                    {t('capa.status.overdue')}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {capa.status !== 'closed' && capa.status !== 'cancelled' && (
                <DxButton
                  text={t('capa.detail.edit')}
                  icon="edit"
                  onClick={() => setShowEditForm(true)}
                  stylingMode="outlined"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                />
              )}
              {canClose && (
                <DxButton
                  text={t('capa.detail.closeCapa')}
                  icon="check"
                  onClick={() => setShowCloseDialog(true)}
                  type="success"
                />
              )}
              {/* Delete is only offered while the CAPA is still "open" (a typo /
                  test entry that isn't a real case). The API enforces the same
                  guard server-side. */}
              {capa.status === 'open' && (
                <DxButton
                  text={t('capa.detail.delete')}
                  icon="trash"
                  onClick={handleDeleteCapa}
                  type="danger"
                  stylingMode="outlined"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow status — สถานะการดำเนินงาน */}
      <div className="container mx-auto px-4 mt-6">
        <StatusStepper
          title={t('capa.detail.workflowTitle')}
          current={capa.status}
          steps={[
            { key: 'open', label: t('capa.detail.workflowStatus.open') },
            { key: 'investigation', label: t('capa.detail.workflowStatus.investigation') },
            { key: 'action_pending', label: t('capa.detail.workflowStatus.actionPending') },
            { key: 'verification', label: t('capa.detail.steps.verifyEffectiveness') },
            { key: 'pending_approval', label: t('capa.detail.workflowStatus.pendingApproval') },
            { key: 'closed', label: t('capa.detail.workflowStatus.closed') },
          ]}
        />
      </div>

      {/* Key Metrics Cards */}
      <div className="container mx-auto px-4 mt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Actions Progress */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t('capa.detail.metrics.actions')}</p>
                  <p className="text-2xl font-bold">{completedActions}/{totalActions}</p>
                  <p className="text-xs text-gray-400">{t('capa.detail.metrics.completed')}</p>
                </div>
                <div className="relative">
                  <svg className="h-16 w-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="6"
                      strokeDasharray={`${actionProgress * 1.76} 176`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                    {actionProgress}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Due Date */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  capa.isOverdue ? 'bg-red-100' : 'bg-blue-100'
                )}>
                  <Calendar className={cn(
                    'h-6 w-6',
                    capa.isOverdue ? 'text-red-600' : 'text-blue-600'
                  )} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('capa.detail.metrics.dueDate')}</p>
                  <p className={cn(
                    'text-lg font-semibold',
                    capa.isOverdue ? 'text-red-600' : 'text-gray-900'
                  )}>
                    {formatDate(capa.dueDate)}
                  </p>
                  {capa.closedDate && (
                    <p className="text-xs text-green-600">{t('capa.detail.metrics.closedOn')}: {formatDate(capa.closedDate)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Score */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${getRiskColor(capa.riskScore)}20` }}>
                  <Gauge className="h-6 w-6" style={{ color: getRiskColor(capa.riskScore) }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('capa.detail.metrics.risk')}</p>
                  <p className="text-lg font-semibold" style={{ color: getRiskColor(capa.riskScore) }}>
                    {capa.riskScore || '-'} / 25
                  </p>
                  <p className="text-xs text-gray-400">{getRiskLevel(capa.riskScore)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Effectiveness */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  hasEffectiveCheck ? 'bg-green-100' : 'bg-gray-100'
                )}>
                  <TrendingUp className={cn(
                    'h-6 w-6',
                    hasEffectiveCheck ? 'text-green-600' : 'text-gray-400'
                  )} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('capa.detail.metrics.effectiveness')}</p>
                  <p className={cn(
                    'text-lg font-semibold',
                    hasEffectiveCheck ? 'text-green-600' : 'text-gray-500'
                  )}>
                    {hasEffectiveCheck ? t('capa.detail.metrics.effective') : t('capa.detail.metrics.pendingCheck')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t('capa.detail.metrics.checkCount', { count: capa.effectivenessChecks?.length || 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Warning Banner */}
      {canClose && !canCloseNow && (
        <div className="container mx-auto px-4 mt-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">{t('capa.detail.cannotCloseTitle')}</p>
                <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                  {!allActionsComplete && <li>{t('capa.detail.cannotCloseActions', { completed: completedActions, total: totalActions })}</li>}
                  {!hasEffectiveCheck && <li>{t('capa.detail.cannotCloseEffectiveness')}</li>}
                </ul>
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
            selectedIndex={TAB_KEYS.indexOf(activeTab)}
            onItemClick={(e) => {
              const index = e.itemData?.id as number;
              if (typeof index === 'number' && TAB_KEYS[index]) {
                setActiveTab(TAB_KEYS[index]);
              }
            }}
            showNavButtons
          />

          <CardContent className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    {t('capa.detail.generalInfo')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('capa.detail.fields.type')}</span>
                      <span className="font-medium capitalize">
                        {capa.type === 'corrective' ? t('capa.detail.typeLong.corrective') :
                         capa.type === 'preventive' ? t('capa.detail.typeLong.preventive') :
                         t('capa.detail.typeLong.both')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('capa.detail.fields.source')}</span>
                      <span className="font-medium capitalize">
                        {capa.sourceType === 'deviation' ? t('capa.detail.source.deviation') :
                         capa.sourceType === 'complaint' ? t('capa.detail.source.complaint') :
                         capa.sourceType === 'audit_finding' ? t('capa.detail.source.auditFinding') : t('capa.detail.source.other')}
                      </span>
                    </div>
                    {capa.sourceNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('capa.detail.fields.referenceNumber')}</span>
                        <span className="font-mono text-indigo-600">{capa.sourceNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('capa.detail.fields.owner')}</span>
                      <span className="font-medium">{capa.ownerName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('capa.detail.fields.createdBy')}</span>
                      <span className="font-medium">{capa.createdByName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('capa.detail.fields.createdAt')}</span>
                      <span className="font-medium">{formatDateTime(capa.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Root Cause Analysis */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-indigo-600" />
                    {t('capa.detail.rootCauseAnalysis')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    {capa.rootCauseCategory && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-500">{t('capa.detail.rootCauseCategory')}</span>
                        <div className="mt-1">
                          <span className={cn(
                            'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                            'bg-indigo-100 text-indigo-700'
                          )}>
                            {ROOT_CAUSE_CATEGORIES[capa.rootCauseCategory]?.labelKey ? t(ROOT_CAUSE_CATEGORIES[capa.rootCauseCategory].labelKey) : capa.rootCauseCategory}
                          </span>
                        </div>
                      </div>
                    )}

                    {capa.rootCauseAnalysis ? (
                      <div>
                        <span className="text-sm text-gray-500">{t('capa.detail.analysisDetail')}</span>
                        <p className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {capa.rootCauseAnalysis}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">{t('capa.detail.noRootCause')}</p>
                    )}
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    {t('capa.detail.workflowTitle')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between overflow-x-auto pb-2">
                      {Object.entries(STATUS_CONFIG)
                        .filter(([key]) => key !== 'cancelled')
                        .sort(([, a], [, b]) => a.step - b.step)
                        .map(([key, config], index, arr) => {
                          const isActive = key === capa.status;
                          const isPassed = config.step < STATUS_CONFIG[capa.status].step;
                          const Icon = config.icon;

                          return (
                            <div key={key} className="flex items-center flex-1">
                              <div className="flex flex-col items-center min-w-[80px]">
                                <div className={cn(
                                  'w-10 h-10 rounded-full flex items-center justify-center',
                                  isActive ? 'bg-indigo-600 text-white' :
                                  isPassed ? 'bg-green-500 text-white' :
                                  'bg-gray-200 text-gray-400'
                                )}>
                                  {isPassed ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className={cn(
                                  'text-xs mt-2 text-center',
                                  isActive ? 'text-indigo-600 font-semibold' :
                                  isPassed ? 'text-green-600' :
                                  'text-gray-400'
                                )}>
                                  {t(config.labelKey)}
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
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <CapaActionList
                capaId={capaId}
                actions={capa.actions}
                canEdit={capa.status !== 'closed' && capa.status !== 'cancelled'}
                onActionAdded={() => refetch()}
                onActionUpdated={() => refetch()}
              />
            )}

            {/* Effectiveness Tab */}
            {activeTab === 'effectiveness' && (
              <CapaEffectivenessForm
                capaId={capaId}
                effectivenessChecks={capa.effectivenessChecks}
                canEdit={capa.status !== 'closed' && capa.status !== 'cancelled'}
                onCheckRecorded={() => refetch()}
              />
            )}

            {/* Risk Assessment Tab */}
            {activeTab === 'risk' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Matrix */}
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Scale className="h-5 w-5 text-indigo-600" />
                    Risk Matrix (ICH Q9)
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="grid grid-cols-6 gap-1 text-center text-xs">
                      {/* Header */}
                      <div className="col-span-6 text-right pr-2 font-semibold mb-2">Probability →</div>
                      <div></div>
                      {Object.entries(RISK_PROBABILITY_LABELS).map(([key, val]) => (
                        <div key={key} className="font-medium">{val.value}</div>
                      ))}

                      {/* Rows */}
                      {Object.entries(RISK_SEVERITY_LABELS).reverse().map(([sKey, sVal]) => (
                        <>
                          <div key={`label-${sKey}`} className="text-right pr-2 font-medium flex items-center justify-end">
                            {sVal.value}
                          </div>
                          {Object.entries(RISK_PROBABILITY_LABELS).map(([pKey, pVal]) => {
                            const score = sVal.value * pVal.value;
                            const isSelected = capa.riskSeverity === sKey && capa.riskProbability === pKey;
                            return (
                              <div
                                key={`${sKey}-${pKey}`}
                                className={cn(
                                  'h-10 rounded flex items-center justify-center font-semibold',
                                  isSelected ? 'ring-2 ring-indigo-600 ring-offset-2' : '',
                                  score <= 4 ? 'bg-green-200 text-green-800' :
                                  score <= 9 ? 'bg-yellow-200 text-yellow-800' :
                                  score <= 16 ? 'bg-orange-200 text-orange-800' :
                                  'bg-red-200 text-red-800'
                                )}
                              >
                                {score}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-green-200" /> Low (1-4)
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-yellow-200" /> Medium (5-9)
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-orange-200" /> High (10-16)
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-red-200" /> Critical (17-25)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-indigo-600" />
                    {t('capa.detail.riskDetails')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('capa.detail.severityLabel')}</span>
                      <span className="font-medium">
                        {capa.riskSeverity ? t(RISK_SEVERITY_LABELS[capa.riskSeverity].labelKey) : '-'}
                        {capa.riskSeverity && ` (${RISK_SEVERITY_LABELS[capa.riskSeverity]?.value}/5)`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('capa.detail.probabilityLabel')}</span>
                      <span className="font-medium">
                        {capa.riskProbability ? t(RISK_PROBABILITY_LABELS[capa.riskProbability].labelKey) : '-'}
                        {capa.riskProbability && ` (${RISK_PROBABILITY_LABELS[capa.riskProbability]?.value}/5)`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-4">
                      <span className="text-gray-500 font-semibold">{t('capa.detail.riskScore')}</span>
                      <span className="text-xl font-bold" style={{ color: getRiskColor(capa.riskScore) }}>
                        {capa.riskScore || '-'} / 25
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('capa.detail.riskLevel')}</span>
                      <span className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium',
                        capa.riskScore && capa.riskScore <= 4 ? 'bg-green-100 text-green-700' :
                        capa.riskScore && capa.riskScore <= 9 ? 'bg-yellow-100 text-yellow-700' :
                        capa.riskScore && capa.riskScore <= 16 ? 'bg-orange-100 text-orange-700' :
                        capa.riskScore ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {getRiskLevel(capa.riskScore)}
                      </span>
                    </div>

                    {capa.riskJustification && (
                      <div className="border-t pt-4">
                        <span className="text-sm text-gray-500">{t('capa.detail.riskJustification')}</span>
                        <p className="mt-1 text-gray-700 dark:text-gray-300">
                          {capa.riskJustification}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Impact Assessment */}
                  <h3 className="text-lg font-semibold flex items-center gap-2 pt-4">
                    <Building className="h-5 w-5 text-indigo-600" />
                    {t('capa.detail.impactAssessment')}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('capa.detail.impactScope')}</span>
                      <span className="font-medium capitalize">
                        {capa.impactScope?.replace('_', ' ') || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('capa.detail.patientImpact')}</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-sm font-medium',
                        capa.patientImpact ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      )}>
                        {capa.patientImpact ? t('capa.detail.yesNo.has') : t('capa.detail.yesNo.hasNot')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('capa.detail.regulatoryNotificationRequired')}</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-sm font-medium',
                        capa.regulatoryNotificationRequired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      )}>
                        {capa.regulatoryNotificationRequired ? t('capa.detail.yesNo.yes') : t('capa.detail.yesNo.no')}
                      </span>
                    </div>
                    {capa.regulatoryNotificationDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">{t('capa.detail.notificationDate')}</span>
                        <span className="font-medium">{formatDate(capa.regulatoryNotificationDate)}</span>
                      </div>
                    )}
                    {capa.regulatoryReferenceNumber && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">{t('capa.detail.fields.referenceNumber')}</span>
                        <span className="font-mono text-indigo-600">{capa.regulatoryReferenceNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
              <DocumentAttachment
                moduleName="capa"
                entityId={capaId}
                title={t('capa.detail.attachmentsTitle')}
                categories={['evidence', 'root_cause', 'investigation', 'report', 'training_record', 'other']}
                readOnly={capa.status === 'closed'}
              />
            )}

            {/* Approvals Tab */}
            {activeTab === 'approvals' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  {t('capa.detail.approvalHistory')}
                </h3>

                {capa.approvals && capa.approvals.length > 0 ? (
                  <DxDataGrid
                    dataSource={capa.approvals}
                    keyExpr="id"
                    showBorders
                    showRowLines
                    rowAlternationEnabled
                  >
                    <DxColumn
                      dataField="approverRole"
                      caption={t('capa.detail.approvalColumns.role')}
                      width={150}
                      cellRender={(data: { data?: CapaApproval }) => {
                        if (!data.data) return null;
                        const roleKeys: Record<string, string> = {
                          owner: 'capa.detail.approvalRoles.owner',
                          qa_reviewer: 'capa.detail.approvalRoles.qaReviewer',
                          qa_manager: 'capa.detail.approvalRoles.qaManager',
                          plant_manager: 'capa.detail.approvalRoles.plantManager',
                        };
                        return roleKeys[data.data.approverRole] ? t(roleKeys[data.data.approverRole]) : data.data.approverRole;
                      }}
                    />
                    <DxColumn dataField="approverName" caption={t('capa.detail.approvalColumns.approver')} />
                    <DxColumn
                      dataField="status"
                      caption={t('capa.detail.approvalColumns.status')}
                      width={120}
                      cellRender={(data: { data?: CapaApproval }) => {
                        if (!data.data) return null;
                        const statusConfig: Record<string, { key: string; class: string }> = {
                          pending: { key: 'capa.detail.approvalStatus.pending', class: 'bg-yellow-100 text-yellow-700' },
                          approved: { key: 'capa.detail.approvalStatus.approved', class: 'bg-green-100 text-green-700' },
                          rejected: { key: 'capa.detail.approvalStatus.rejected', class: 'bg-red-100 text-red-700' },
                          revision_required: { key: 'capa.detail.approvalStatus.revisionRequired', class: 'bg-orange-100 text-orange-700' },
                        };
                        const config = statusConfig[data.data.status];
                        return (
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config?.class)}>
                            {config?.key ? t(config.key) : data.data.status}
                          </span>
                        );
                      }}
                    />
                    <DxColumn dataField="comments" caption={t('capa.detail.approvalColumns.comments')} />
                    <DxColumn
                      dataField="signedAt"
                      caption={t('capa.detail.approvalColumns.signedAt')}
                      width={150}
                      cellRender={(data: { data?: CapaApproval }) => {
                        if (!data.data) return null;
                        return formatDateTime(data.data.signedAt);
                      }}
                    />
                  </DxDataGrid>
                ) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('capa.detail.noApprovalHistory')}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit CAPA Dialog */}
      <CapaDataEntryDialog
        visible={showEditForm}
        onClose={() => setShowEditForm(false)}
        onSaved={() => {
          setShowEditForm(false);
          refetch();
        }}
        capa={capa}
      />

      {/* Close CAPA Dialog */}
      <DxPopup
        visible={showCloseDialog}
        onHiding={() => setShowCloseDialog(false)}
        title={t('capa.detail.closeCapa')}
        width={550}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {/* Closure Checklist */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">{t('capa.detail.closure.checklistTitle')}</p>
            {closureChecklist.map((item, idx) => (
              <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${item.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {item.ok ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${item.ok ? 'text-green-800' : 'text-red-800'}`}>
                    {item.label}
                  </span>
                </div>
                <span className={`text-xs ${item.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {item.detail}
                </span>
              </div>
            ))}
          </div>

          {canCloseNow ? (
            <>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">{t('capa.detail.closure.readyToClose')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('capa.detail.closure.notesLabel')}</label>
                <DxTextArea
                  value={closureNotes}
                  onValueChange={(value) => setClosureNotes(value || '')}
                  placeholder={t('capa.detail.closure.notesPlaceholder')}
                  height={100}
                />
              </div>
            </>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 font-medium">{t('capa.detail.closure.cannotClose')}</p>
            </div>
          )}

          {closeMutation.error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm whitespace-pre-line">
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
              text={t('capa.detail.closeCapa')}
              icon="check"
              onClick={() => closeMutation.mutate()}
              type="success"
              disabled={!canCloseNow || closeMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
