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

// ============================================
// Configuration
// ============================================

const SEVERITY_CONFIG: Record<ComplaintSeverity, {
  label: string;
  labelTh: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  minor: {
    label: 'Minor',
    labelTh: 'น้อย',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-500',
  },
  major: {
    label: 'Major',
    labelTh: 'ปานกลาง',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-500',
  },
  critical: {
    label: 'Critical',
    labelTh: 'วิกฤต',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-red-500',
  },
};

const STATUS_CONFIG: Record<ComplaintStatus, {
  label: string;
  labelTh: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  step: number;
}> = {
  received: {
    label: 'Received',
    labelTh: 'ได้รับ',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: CircleDot,
    step: 1,
  },
  under_investigation: {
    label: 'Under Investigation',
    labelTh: 'กำลังสืบสวน',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Search,
    step: 2,
  },
  resolved: {
    label: 'Resolved',
    labelTh: 'แก้ไขแล้ว',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: ClipboardCheck,
    step: 3,
  },
  closed: {
    label: 'Closed',
    labelTh: 'ปิด',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: CheckCircle,
    step: 4,
  },
};

const SOURCE_CONFIG: Record<ComplaintSource, { label: string; labelTh: string }> = {
  customer: { label: 'Customer', labelTh: 'ลูกค้า' },
  distributor: { label: 'Distributor', labelTh: 'ผู้จัดจำหน่าย' },
  regulatory: { label: 'Regulatory', labelTh: 'หน่วยงานกำกับ' },
  internal: { label: 'Internal', labelTh: 'ภายใน' },
};

const CATEGORY_CONFIG: Record<ComplaintCategory, { label: string; labelTh: string; color: string }> = {
  quality: { label: 'Quality', labelTh: 'คุณภาพ', color: '#3b82f6' },
  efficacy: { label: 'Efficacy', labelTh: 'ประสิทธิภาพ', color: '#8b5cf6' },
  safety: { label: 'Safety', labelTh: 'ความปลอดภัย', color: '#ef4444' },
  packaging: { label: 'Packaging', labelTh: 'บรรจุภัณฑ์', color: '#f59e0b' },
  labeling: { label: 'Labeling', labelTh: 'ฉลาก', color: '#06b6d4' },
  other: { label: 'Other', labelTh: 'อื่นๆ', color: '#6b7280' },
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

  // Tabs configuration
  const tabs: DxTabItem[] = useMemo(() => [
    { id: TAB_IDS.overview, text: 'ภาพรวม', icon: 'home' },
    { id: TAB_IDS.investigation, text: 'การสืบสวน', icon: 'search' },
    { id: TAB_IDS.attachments, text: 'เอกสารแนบ', icon: 'attach' },
  ], []);

  // Computed values
  const statusConfig = complaint ? STATUS_CONFIG[complaint.status] : null;
  const severityConfig = complaint ? SEVERITY_CONFIG[complaint.severity] : null;
  const categoryConfig = complaint ? CATEGORY_CONFIG[complaint.category] : null;
  const sourceConfig = complaint ? SOURCE_CONFIG[complaint.source] : null;
  const canClose = complaint?.status === 'resolved';
  const isOpen = complaint?.status !== 'closed';
  const hasInvestigation = !!complaint?.investigation;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <DxLoadIndicator height={60} width={60} />
          <p className="mt-4 text-gray-500">Loading complaint details...</p>
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
            <p className="text-gray-500 mb-6">{error?.message || 'Complaint not found'}</p>
            <div className="flex gap-3 justify-center">
              <DxButton
                text="Go Back"
                icon="back"
                onClick={() => router.back()}
                stylingMode="outlined"
              />
              <DxButton
                text="Retry"
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
        'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500',
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
              <span>Back to Complaints</span>
            </button>
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                hint="Refresh"
                onClick={() => refetch()}
                stylingMode="text"
                className="text-white"
              />
              <DxButton
                icon="print"
                hint="Print"
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
                  <MessageSquareWarning className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">
                    ข้อร้องเรียน {complaint.complaintNumber}
                  </h1>
                  <p className="text-white/80 text-lg">{complaint.productName || 'Unknown Product'}</p>
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
                    {statusConfig.labelTh}
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
                    {severityConfig.labelTh}
                  </span>
                )}

                {/* Category Badge */}
                {categoryConfig && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                    <FileText className="h-4 w-4" />
                    {categoryConfig.labelTh}
                  </span>
                )}

                {/* Regulatory Warning */}
                {complaint.regulatoryReportRequired && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-500 text-white">
                    <ShieldAlert className="h-4 w-4" />
                    ต้องแจ้งหน่วยงานกำกับ
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isOpen && (
                <DxButton
                  text="แก้ไข"
                  icon="edit"
                  onClick={() => setShowEditDialog(true)}
                  stylingMode="outlined"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                />
              )}
              {canClose && (
                <DxButton
                  text="ปิดข้อร้องเรียน"
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
          title="สถานะการดำเนินงาน"
          current={complaint.status}
          steps={[
            { key: 'received', label: 'รับเรื่อง' },
            { key: 'under_investigation', label: 'กำลังสอบสวน' },
            { key: 'resolved', label: 'แก้ไขแล้ว' },
            { key: 'closed', label: 'ปิด' },
          ]}
        />
      </div>

      {/* Key Metrics Cards */}
      <div className="container mx-auto px-4 -mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Severity */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-3 rounded-xl', severityConfig?.bgClass || 'bg-gray-100')}>
                  <Gauge className={cn('h-6 w-6', severityConfig?.textClass || 'text-gray-600')} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ความรุนแรง</p>
                  <p className={cn('text-lg font-semibold', severityConfig?.textClass || 'text-gray-900')}>
                    {severityConfig?.labelTh || '-'}
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
                  <p className="text-sm text-gray-500">หมวดหมู่</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {categoryConfig?.labelTh || '-'}
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
                  <p className="text-sm text-gray-500">แหล่งที่มา</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {sourceConfig?.labelTh || '-'}
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
                  <p className="text-sm text-gray-500">การสืบสวน</p>
                  <p className={cn(
                    'text-lg font-semibold',
                    hasInvestigation ? 'text-green-600' : 'text-gray-500'
                  )}>
                    {complaint.investigation?.completionDate ? 'เสร็จสิ้น' :
                     hasInvestigation ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {complaint.investigation?.investigatorName || 'ยังไม่ได้มอบหมาย'}
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
                  ต้องรายงานหน่วยงานกำกับ (Regulatory Report Required)
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {complaint.regulatoryReportDate
                    ? `รายงานเมื่อ: ${formatDate(complaint.regulatoryReportDate)}`
                    : 'ยังไม่ได้รายงาน - กรุณาดำเนินการโดยเร็ว'}
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
                    ข้อมูลทั่วไป
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">เลขที่ข้อร้องเรียน</span>
                      <span className="font-mono font-medium">{complaint.complaintNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">วันที่ได้รับ</span>
                      <span className="font-medium">{formatDate(complaint.receivedDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ผลิตภัณฑ์</span>
                      <span className="font-medium">{complaint.productName || '-'}</span>
                    </div>
                    {complaint.lotNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">เลขที่ล็อต</span>
                        <span className="font-mono">{complaint.lotNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">ผู้บันทึก</span>
                      <span className="font-medium">{complaint.createdByName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">วันที่สร้าง</span>
                      <span className="font-medium">{formatDateTime(complaint.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-orange-600" />
                    ข้อมูลผู้ร้องเรียน
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">แหล่งที่มา</span>
                      <span className="font-medium">{sourceConfig?.labelTh || complaint.source}</span>
                    </div>
                    {complaint.customerName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">ชื่อ</span>
                        <span className="font-medium">{complaint.customerName}</span>
                      </div>
                    )}
                    {complaint.customerContact && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">ช่องทางติดต่อ</span>
                        <span className="font-medium">{complaint.customerContact}</span>
                      </div>
                    )}
                    {!complaint.customerName && !complaint.customerContact && (
                      <p className="text-gray-400 italic">ไม่ได้ระบุข้อมูลผู้ร้องเรียน</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    รายละเอียดข้อร้องเรียน
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
                    สถานะการดำเนินงาน
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
                                  {config.labelTh}
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
                      เอกสารที่เกี่ยวข้อง
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
                      ข้อมูลการปิด
                    </h3>

                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">วันที่ปิด</span>
                          <p className="font-medium text-green-700 dark:text-green-300">
                            {formatDate(complaint.closedDate)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">ปิดโดย</span>
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
                title="เอกสารแนบ (Attachments)"
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
        title="ปิดข้อร้องเรียน"
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
                  การสืบสวนเสร็จสิ้น
                </p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  ข้อร้องเรียนพร้อมที่จะปิดได้แล้ว
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">หมายเหตุการปิด (ไม่บังคับ)</label>
            <DxTextArea
              value={closureNotes}
              onValueChange={(value) => setClosureNotes(value || '')}
              placeholder="เพิ่มหมายเหตุเกี่ยวกับการปิดข้อร้องเรียนนี้..."
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
              text="ยกเลิก"
              onClick={() => setShowCloseDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="ปิดข้อร้องเรียน"
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
