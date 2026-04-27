'use client';

/**
 * Reusable Execution Dashboard Component
 * Shows execution sections grouped by phase with progress bars
 * Used in both WO detail page (Execution tab) and standalone execution page
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardCheck,
  Thermometer,
  Scale,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ClipboardList,
  FlaskConical,
  Lock,
  Boxes,
} from 'lucide-react';

interface ExecutionSummary {
  workOrderStatus?: string;
  materialWeighing: { total: number; completed: number; verified: number };
  preProductionCleaning: { total: number; completed: number; verified: number };
  preProductionEnvironmental: { total: number; recorded: number; normal: number };
  productionCleaning?: { total: number; completed: number; verified: number };
  sopExecution: { total: number; completed: number; verified: number };
  productionEnvironmental: { total: number; recorded: number; normal: number };
  productionOutput: { recorded: boolean; actualQuantity: number | null; yieldPercent: number | null };
  bulkOutput?: { recorded: boolean; quantity: number | null; recordedAt: string | null };
  finishedOutput?: { recorded: boolean; quantity: number | null; recordedAt: string | null };
  postProductionCleaning: { total: number; completed: number; verified: number };
  prePackagingCleaning: { total: number; completed: number; verified: number };
  packagingCleaning?: { total: number; completed: number; verified: number };
  packagingWeight: { total: number; passed: number };
  packagingIntegrity: { total: number; passed: number };
  packagingEnvironmental: { total: number; recorded: number; normal: number };
  finishedInspection: { status: 'pending' | 'in_progress' | 'passed' | 'failed' };
  ipc: { total: number; completed: number; approved: number };
  materialRequisition: {
    status: 'none' | 'requested' | 'approved';
    requestedBy: number | null;
    requestedAt: string | null;
    approvedBy: number | null;
    approvedAt: string | null;
    requestedByName?: string;
    approvedByName?: string;
  };
}

/**
 * Section status returned by getStatus(). The badge shows a different count
 * depending on which milestone the section is at:
 *   - in_progress:  X = completed (operator progress)
 *   - completed:    X = verified  (verifier progress)
 *   - verified:     X = verified  (= total)
 * Sections with hasVerification=false skip the verified milestone — they jump
 * straight to "completed" when all items are done and stay there.
 */
interface SectionStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  /** Items the operator has actioned (e.g., marked clean / weighed / recorded) */
  completed: number;
  /** Items a second party has verified. Equals completed when hasVerification=false */
  verified: number;
  total: number;
  hasVerification: boolean;
}

interface ExecutionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  href: string;
  phase: 'pre_production' | 'production' | 'post_production' | 'pre_packaging' | 'packaging' | 'inspection';
  description: string;
  getStatus: (summary: ExecutionSummary) => SectionStatus;
}

/** Compute the milestone-aware status from raw counts. */
function computeStatus(
  completed: number,
  verified: number,
  total: number,
  hasVerification: boolean,
): SectionStatus {
  const base = { completed, verified, total, hasVerification };
  if (total === 0 || completed === 0) {
    return { ...base, status: 'pending' };
  }
  if (completed < total) {
    return { ...base, status: 'in_progress' };
  }
  // completed === total
  if (!hasVerification) {
    return { ...base, status: 'completed' };
  }
  if (verified < total) {
    return { ...base, status: 'completed' };
  }
  return { ...base, status: 'verified' };
}

const phaseColors = {
  pre_production: 'bg-amber-100 text-amber-800 border-amber-200',
  production: 'bg-blue-100 text-blue-800 border-blue-200',
  post_production: 'bg-green-100 text-green-800 border-green-200',
  pre_packaging: 'bg-purple-100 text-purple-800 border-purple-200',
  packaging: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  inspection: 'bg-teal-100 text-teal-800 border-teal-200',
};

const phaseLabels = {
  pre_production: 'Pre-Production',
  production: 'Production',
  post_production: 'Post-Production',
  pre_packaging: 'Pre-Packaging',
  packaging: 'Packaging',
  inspection: 'Inspection',
};

const defaultSummaryValue: ExecutionSummary = {
  workOrderStatus: 'planned',
  materialWeighing: { total: 0, completed: 0, verified: 0 },
  preProductionCleaning: { total: 0, completed: 0, verified: 0 },
  preProductionEnvironmental: { total: 0, recorded: 0, normal: 0 },
  productionCleaning: { total: 0, completed: 0, verified: 0 },
  sopExecution: { total: 0, completed: 0, verified: 0 },
  productionEnvironmental: { total: 0, recorded: 0, normal: 0 },
  productionOutput: { recorded: false, actualQuantity: null, yieldPercent: null },
  bulkOutput: { recorded: false, quantity: null, recordedAt: null },
  finishedOutput: { recorded: false, quantity: null, recordedAt: null },
  postProductionCleaning: { total: 0, completed: 0, verified: 0 },
  prePackagingCleaning: { total: 0, completed: 0, verified: 0 },
  packagingCleaning: { total: 0, completed: 0, verified: 0 },
  packagingWeight: { total: 0, passed: 0 },
  packagingIntegrity: { total: 0, passed: 0 },
  packagingEnvironmental: { total: 0, recorded: 0, normal: 0 },
  finishedInspection: { status: 'pending' },
  ipc: { total: 0, completed: 0, approved: 0 },
  materialRequisition: { status: 'none', requestedBy: null, requestedAt: null, approvedBy: null, approvedAt: null },
};

interface ExecutionDashboardProps {
  workOrderId: number;
}

export function ExecutionDashboard({ workOrderId }: ExecutionDashboardProps) {
  const toast = useToast();
  const t = useTranslations('production');
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery<ExecutionSummary>({
    queryKey: ['wo-execution-summary', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/execution-summary`);
      const data = await res.json();
      if (!data.success) return defaultSummaryValue;
      return data.data;
    },
  });

  // Auto-update when another user changes this requisition's status
  // (e.g. warehouse approves on /inventory/lots → status here flips
  // from 'รอคลังอนุมัติ' to 'อนุมัติแล้ว' without manual refresh).
  useRealtimeTopic('requisition-changed', (data) => {
    const eventWorkOrderId = data.workOrderId as number | undefined;
    if (eventWorkOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Phase: any execution sub-section change re-fetches the dashboard summary
  // so progress bars / status pills stay in sync across users.
  useRealtimeTopic('work-order-changed', (data) => {
    const eventWorkOrderId = data.workOrderId as number | undefined;
    if (eventWorkOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  const requisitionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
      toast.success('ส่งใบเบิกวัตถุดิบสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const executionSections: ExecutionSection[] = [
    {
      id: 'material-requisition',
      title: 'ใบเบิกวัตถุดิบ',
      icon: <ClipboardList className="h-5 w-5" />,
      href: '',
      phase: 'pre_production',
      description: 'ส่งใบเบิกวัตถุดิบให้คลังอนุมัติก่อนชั่ง',
      // Treats 'requested'=completed, 'approved'=verified to fit the
      // 4-step badge model — same milestones as the other dual-control sections.
      getStatus: (s) => computeStatus(
        s.materialRequisition.status === 'requested' || s.materialRequisition.status === 'approved' ? 1 : 0,
        s.materialRequisition.status === 'approved' ? 1 : 0,
        1,
        true,
      ),
    },
    {
      id: 'pre-production-cleaning',
      title: 'Pre-Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=pre_production`,
      phase: 'pre_production',
      description: 'Verify room and equipment cleanliness before production',
      getStatus: (s) => computeStatus(
        s.preProductionCleaning.completed,
        s.preProductionCleaning.verified,
        s.preProductionCleaning.total,
        true,
      ),
    },
    {
      id: 'pre-production-environmental',
      title: 'Environmental Monitoring (Pre-Production)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=pre_production`,
      phase: 'pre_production',
      description: 'Record temperature and humidity before production',
      getStatus: (s) => computeStatus(
        s.preProductionEnvironmental?.recorded ?? 0,
        s.preProductionEnvironmental?.recorded ?? 0,
        s.preProductionEnvironmental?.total ?? 0,
        false,
      ),
    },
    {
      id: 'material-weighing',
      title: 'Material Weighing',
      icon: <Scale className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/material-weighing`,
      phase: 'pre_production',
      description: 'Weigh and verify all raw materials according to BOM',
      getStatus: (s) => computeStatus(
        s.materialWeighing.completed,
        s.materialWeighing.verified,
        s.materialWeighing.total,
        true,
      ),
    },
    {
      id: 'sop-execution',
      title: 'SOP Execution',
      icon: <ClipboardList className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/sop-execution`,
      phase: 'production',
      description: 'Execute production steps with parameter recording',
      getStatus: (s) => computeStatus(
        s.sopExecution.completed,
        s.sopExecution.verified,
        s.sopExecution.total,
        true,
      ),
    },
    {
      id: 'production-cleaning',
      title: 'Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=production`,
      phase: 'production',
      description: 'Verify room and equipment cleanliness during production',
      getStatus: (s) => {
        const c = s.productionCleaning ?? { total: 0, completed: 0, verified: 0 };
        return computeStatus(c.completed, c.verified, c.total, true);
      },
    },
    {
      id: 'ipc',
      title: t('execution.ipc'),
      icon: <FlaskConical className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/ipc`,
      phase: 'production',
      description: t('execution.ipcDescription'),
      getStatus: (s) => computeStatus(
        s.ipc.completed,
        s.ipc.approved,
        s.ipc.total,
        true,
      ),
    },
    {
      id: 'production-environmental',
      title: 'Environmental Monitoring (Production)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=production`,
      phase: 'production',
      description: 'Record temperature and humidity during production',
      getStatus: (s) => computeStatus(
        s.productionEnvironmental.recorded,
        s.productionEnvironmental.recorded,
        s.productionEnvironmental.total,
        false,
      ),
    },
    {
      id: 'post-production-cleaning',
      title: 'Post-Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=post_production`,
      phase: 'post_production',
      description: 'Clean room and equipment after production',
      getStatus: (s) => computeStatus(
        s.postProductionCleaning.completed,
        s.postProductionCleaning.verified,
        s.postProductionCleaning.total,
        true,
      ),
    },
    {
      id: 'bulk-product-yield',
      title: 'Bulk Product Yield',
      icon: <Package className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/production-output?stage=bulk`,
      phase: 'post_production',
      description: 'บันทึกจำนวนผลิตภัณฑ์บัลก์หลังกระบวนการผลิต ก่อนเข้าสู่การบรรจุภัณฑ์',
      getStatus: (s) => computeStatus(
        s.bulkOutput?.recorded ? 1 : 0,
        s.bulkOutput?.recorded ? 1 : 0,
        1,
        false,
      ),
    },
    {
      id: 'pre-packaging-cleaning',
      title: 'Pre-Packaging Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=pre_packaging`,
      phase: 'pre_packaging',
      description: 'Verify packaging area cleanliness',
      getStatus: (s) => computeStatus(
        s.prePackagingCleaning.completed,
        s.prePackagingCleaning.verified,
        s.prePackagingCleaning.total,
        true,
      ),
    },
    {
      id: 'packaging-cleaning',
      title: 'Packaging Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=packaging`,
      phase: 'packaging',
      description: 'Verify packaging area cleanliness during packaging',
      getStatus: (s) => {
        const c = s.packagingCleaning ?? { total: 0, completed: 0, verified: 0 };
        return computeStatus(c.completed, c.verified, c.total, true);
      },
    },
    {
      id: 'packaging-weight',
      title: 'Packaging Weight Control',
      icon: <Scale className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/packaging-qc?tab=weight`,
      phase: 'packaging',
      description: 'Sample weight verification during packaging',
      getStatus: (s) => computeStatus(
        s.packagingWeight.passed,
        s.packagingWeight.passed,
        s.packagingWeight.total,
        false,
      ),
    },
    {
      id: 'packaging-integrity',
      title: 'Packaging Integrity',
      icon: <Package className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/packaging-qc?tab=integrity`,
      phase: 'packaging',
      description: 'Cap, label, and packing verification',
      getStatus: (s) => computeStatus(
        s.packagingIntegrity.passed,
        s.packagingIntegrity.passed,
        s.packagingIntegrity.total,
        false,
      ),
    },
    {
      id: 'packaging-environmental',
      title: 'Environmental Monitoring (Packaging)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=packaging`,
      phase: 'packaging',
      description: 'Record temperature and humidity during packaging',
      getStatus: (s) => computeStatus(
        s.packagingEnvironmental.recorded,
        s.packagingEnvironmental.recorded,
        s.packagingEnvironmental.total,
        false,
      ),
    },
    {
      id: 'finished-inspection',
      title: 'Finished Product Inspection',
      icon: <ClipboardCheck className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/finished-inspection`,
      phase: 'inspection',
      description: '15-point inspection checklist',
      getStatus: (s) => computeStatus(
        s.finishedInspection.status === 'passed' || s.finishedInspection.status === 'in_progress' ? 1 : 0,
        s.finishedInspection.status === 'passed' ? 1 : 0,
        1,
        false,
      ),
    },
    {
      id: 'production-output',
      title: 'Production Output / Yield',
      icon: <Boxes className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/production-output?stage=finished`,
      phase: 'inspection',
      description: 'บันทึกจำนวนผลิตภัณฑ์สำเร็จรูปหลัง Inspection เพื่อเข้าคลัง FG',
      getStatus: (s) => computeStatus(
        s.finishedOutput?.recorded ? 1 : 0,
        s.finishedOutput?.recorded ? 1 : 0,
        1,
        false,
      ),
    },
  ];

  /**
   * Renders the section status badge with the operator's progress count (X/Y).
   * X is always the "marked / completed" count so users immediately see how much
   * of the section's work has been done. The status label tracks the milestone:
   *   - Pending      — not started (no count)
   *   - In Progress  — some marked, not all
   *   - Completed    — all marked; awaiting verification (when applicable)
   *   - Verified     — verified === total
   *
   * For dual-control sections (cleaning, weighing, SOP, IPC) the verifier's
   * progress is shown as a small subtext next to the badge, e.g. "ตรวจ 1/3",
   * so it's visible without crowding the main label.
   */
  const renderStatusBadge = (info: SectionStatus) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-600',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      verified: 'bg-blue-100 text-blue-700',
    };
    const labels = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      verified: 'Verified',
    };
    const icons = {
      pending: <Clock className="h-3 w-3" />,
      in_progress: <Clock className="h-3 w-3" />,
      completed: <CheckCircle2 className="h-3 w-3" />,
      verified: <CheckCircle2 className="h-3 w-3" />,
    };

    // Main count: operator progress (marked / total). When verified, switch to
    // verified count so the badge reads the milestone it just hit.
    let countSuffix = '';
    if (info.total > 0 && info.status !== 'pending') {
      const current = info.status === 'verified' ? info.verified : info.completed;
      countSuffix = ` (${current}/${info.total})`;
    }

    // Verifier-progress subtext only when meaningful: section uses verification,
    // marking is done, and verification is in progress (0 ≤ verified < total).
    const showVerifySubtext =
      info.hasVerification &&
      info.status === 'completed' &&
      info.total > 0;

    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[info.status]}`}>
          {icons[info.status]}
          {labels[info.status]}{countSuffix}
        </span>
        {showVerifySubtext && (
          <span className="text-[11px] text-blue-600/80 font-medium">
            ตรวจ {info.verified}/{info.total}
          </span>
        )}
      </span>
    );
  };

  const renderProgressBar = (completed: number, total: number) => {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs text-gray-500 w-12 text-right">{completed}/{total}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <DxLoadIndicator />
      </div>
    );
  }

  const currentSummary = summary || defaultSummaryValue;

  // Determine which sections are locked based on workflow prerequisites
  const isSectionLocked = (sectionId: string): { locked: boolean; reason: string } => {
    const s = currentSummary;
    const woStatus = s.workOrderStatus || 'planned';

    // Pre-production: cleaning & environmental are always accessible
    // Material weighing: requires requisition approved
    if (sectionId === 'material-weighing') {
      if (s.materialRequisition.status !== 'approved') {
        return { locked: true, reason: 'ต้องอนุมัติใบเบิกวัตถุดิบก่อน' };
      }
    }

    // Production phase: requires WO status >= in_progress
    if (['sop-execution', 'ipc', 'production-environmental'].includes(sectionId)) {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }
    }

    // Post-production: requires SOP execution started
    if (sectionId === 'post-production-cleaning') {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }
    }

    // Packaging phase: requires WO status >= in_progress
    if (['pre-packaging-cleaning', 'packaging-weight', 'packaging-integrity', 'packaging-environmental'].includes(sectionId)) {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }
    }

    // Inspection: requires packaging steps done
    if (sectionId === 'finished-inspection') {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }
    }

    // Bulk Product Yield — FINAL step: requires all prior phases complete
    // Gate on Finished Inspection passed (which itself chains all prior dependencies)
    if (sectionId === 'production-output') {
      if (woStatus === 'planned' || woStatus === 'released') {
        return { locked: true, reason: 'ต้องเปลี่ยนสถานะ WO เป็น In Progress ก่อน' };
      }
      if (s.finishedInspection.status !== 'passed') {
        return { locked: true, reason: 'ต้องผ่าน Finished Product Inspection ก่อน' };
      }
      // Also require packaging to be complete (all three packaging checks passed)
      const pkgWeightDone = s.packagingWeight.total > 0 && s.packagingWeight.passed === s.packagingWeight.total;
      const pkgIntegrityDone = s.packagingIntegrity.total > 0 && s.packagingIntegrity.passed === s.packagingIntegrity.total;
      if (!pkgWeightDone || !pkgIntegrityDone) {
        return { locked: true, reason: 'ต้องผ่านขั้นตอน Packaging QC (Weight + Integrity) ก่อน' };
      }
    }

    return { locked: false, reason: '' };
  };

  const sectionsByPhase = executionSections.reduce((acc, section) => {
    if (!acc[section.phase]) acc[section.phase] = [];
    acc[section.phase].push(section);
    return acc;
  }, {} as Record<string, ExecutionSection[]>);

  const phases = ['pre_production', 'production', 'post_production', 'pre_packaging', 'packaging', 'inspection'] as const;

  return (
    <div className="space-y-4">
      {/* BOM Configuration Summary */}
      <BOMConfigReferencePanel workOrderId={workOrderId} defaultExpanded={false} />

      {/* Execution Sections by Phase */}
      {phases.map((phase) => {
        const sections = sectionsByPhase[phase];
        if (!sections || sections.length === 0) return null;

        return (
          <div key={phase} className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${phaseColors[phase]}`}>
              {phaseLabels[phase]}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => {
                const sectionStatus = section.getStatus(currentSummary);

                if (section.id === 'material-requisition') {
                  const reqStatus = currentSummary.materialRequisition;
                  return (
                    <Card key={section.id} className="h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${phaseColors[section.phase].split(' ')[0]}`}>
                              {section.icon}
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{section.title}</h3>
                              <p className="text-sm text-gray-500">{section.description}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {renderProgressBar(sectionStatus.completed, sectionStatus.total)}
                          <div className="flex justify-end">
                            {renderStatusBadge(sectionStatus)}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          {reqStatus.status === 'none' && (
                            <DxButton
                              text="ส่งใบเบิกวัตถุดิบ"
                              type="success"
                              stylingMode="contained"
                              disabled={requisitionMutation.isPending}
                              onClick={() => requisitionMutation.mutate()}
                            />
                          )}
                          {reqStatus.status === 'requested' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <Clock className="h-3 w-3" />
                                รอคลังอนุมัติ
                              </span>
                              <span className="text-xs text-gray-500">
                                {reqStatus.requestedByName && `โดย ${reqStatus.requestedByName}`}
                                {reqStatus.requestedAt && ` เมื่อ ${new Date(reqStatus.requestedAt).toLocaleString('th-TH')}`}
                              </span>
                            </div>
                          )}
                          {reqStatus.status === 'approved' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <CheckCircle2 className="h-3 w-3" />
                                คลังอนุมัติแล้ว
                              </span>
                              <span className="text-xs text-gray-500">
                                {reqStatus.approvedByName && `โดย ${reqStatus.approvedByName}`}
                                {reqStatus.approvedAt && ` เมื่อ ${new Date(reqStatus.approvedAt).toLocaleString('th-TH')}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                const lockInfo = isSectionLocked(section.id);
                const cardContent = (
                  <Card className={`h-full transition-shadow ${lockInfo.locked ? 'opacity-50' : 'hover:shadow-md cursor-pointer'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${phaseColors[section.phase].split(' ')[0]}`}>
                            {section.icon}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{section.title}</h3>
                            <p className="text-sm text-gray-500">{section.description}</p>
                          </div>
                        </div>
                        {lockInfo.locked
                          ? <Lock className="h-5 w-5 text-gray-400" />
                          : <ArrowRight className="h-5 w-5 text-gray-400" />}
                      </div>
                      {lockInfo.locked ? (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                          {lockInfo.reason}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {renderProgressBar(sectionStatus.completed, sectionStatus.total)}
                          <div className="flex justify-end">
                            {renderStatusBadge(sectionStatus)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );

                if (lockInfo.locked) {
                  return <div key={section.id}>{cardContent}</div>;
                }
                return (
                  <Link key={section.id} href={section.href}>
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Alert for unconfigured BOM */}
      {Object.values(currentSummary).every(v =>
        typeof v === 'object' && 'total' in v && (v as any).total === 0
      ) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">BOM Configuration Required</p>
              <p className="text-sm text-amber-700">
                This work order&apos;s BOM has not been configured. Please configure rooms, equipment,
                SOP steps, and other requirements before starting execution.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
