'use client';

/**
 * Work Order Execution Dashboard
 * Main dashboard for executing GMP production steps
 * Follows BMPR Form [2568] requirements
 */

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ResponsivePageHeader } from '@/components/shared';
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
} from 'lucide-react';

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
  plannedQuantity: number;
  actualQuantity: number;
}

interface ExecutionSummary {
  materialWeighing: {
    total: number;
    completed: number;
    verified: number;
  };
  preProductionCleaning: {
    total: number;
    completed: number;
    verified: number;
  };
  sopExecution: {
    total: number;
    completed: number;
    verified: number;
  };
  productionEnvironmental: {
    total: number;
    recorded: number;
    normal: number;
  };
  productionOutput: {
    recorded: boolean;
    actualQuantity: number | null;
    yieldPercent: number | null;
  };
  postProductionCleaning: {
    total: number;
    completed: number;
    verified: number;
  };
  prePackagingCleaning: {
    total: number;
    completed: number;
    verified: number;
  };
  packagingWeight: {
    total: number;
    passed: number;
  };
  packagingIntegrity: {
    total: number;
    passed: number;
  };
  packagingEnvironmental: {
    total: number;
    recorded: number;
    normal: number;
  };
  finishedInspection: {
    status: 'pending' | 'in_progress' | 'passed' | 'failed';
  };
  ipc: {
    total: number;
    completed: number;
    approved: number;
  };
}

interface ExecutionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  href: string;
  phase: 'pre_production' | 'production' | 'post_production' | 'pre_packaging' | 'packaging' | 'inspection';
  description: string;
  getStatus: (summary: ExecutionSummary) => { completed: number; total: number; status: 'pending' | 'in_progress' | 'completed' | 'verified' };
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

export default function WorkOrderExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('execution.title');
  const workOrderId = Number(params.id);

  // Fetch Work Order basic info
  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  // Fetch execution summary
  const { data: summary } = useQuery<ExecutionSummary>({
    queryKey: ['wo-execution-summary', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/execution-summary`);
      const data = await res.json();
      if (!data.success) {
        // Return default summary if API not ready
        return {
          materialWeighing: { total: 0, completed: 0, verified: 0 },
          preProductionCleaning: { total: 0, completed: 0, verified: 0 },
          sopExecution: { total: 0, completed: 0, verified: 0 },
          productionEnvironmental: { total: 0, recorded: 0, normal: 0 },
          productionOutput: { recorded: false, actualQuantity: null, yieldPercent: null },
          postProductionCleaning: { total: 0, completed: 0, verified: 0 },
          prePackagingCleaning: { total: 0, completed: 0, verified: 0 },
          packagingWeight: { total: 0, passed: 0 },
          packagingIntegrity: { total: 0, passed: 0 },
          packagingEnvironmental: { total: 0, recorded: 0, normal: 0 },
          finishedInspection: { status: 'pending' },
          ipc: { total: 0, completed: 0, approved: 0 },
        };
      }
      return data.data;
    },
  });

  const executionSections: ExecutionSection[] = [
    {
      id: 'material-weighing',
      title: 'Material Weighing',
      icon: <Scale className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/material-weighing`,
      phase: 'pre_production',
      description: 'Weigh and verify all raw materials according to BOM',
      getStatus: (s) => ({
        completed: s.materialWeighing.completed,
        total: s.materialWeighing.total,
        status: s.materialWeighing.verified === s.materialWeighing.total && s.materialWeighing.total > 0
          ? 'verified'
          : s.materialWeighing.completed === s.materialWeighing.total && s.materialWeighing.total > 0
          ? 'completed'
          : s.materialWeighing.completed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'pre-production-cleaning',
      title: 'Pre-Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=pre_production`,
      phase: 'pre_production',
      description: 'Verify room and equipment cleanliness before production',
      getStatus: (s) => ({
        completed: s.preProductionCleaning.completed,
        total: s.preProductionCleaning.total,
        status: s.preProductionCleaning.verified === s.preProductionCleaning.total && s.preProductionCleaning.total > 0
          ? 'verified'
          : s.preProductionCleaning.completed === s.preProductionCleaning.total && s.preProductionCleaning.total > 0
          ? 'completed'
          : s.preProductionCleaning.completed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'sop-execution',
      title: 'SOP Execution',
      icon: <ClipboardList className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/sop-execution`,
      phase: 'production',
      description: 'Execute production steps with parameter recording',
      getStatus: (s) => ({
        completed: s.sopExecution.completed,
        total: s.sopExecution.total,
        status: s.sopExecution.verified === s.sopExecution.total && s.sopExecution.total > 0
          ? 'verified'
          : s.sopExecution.completed === s.sopExecution.total && s.sopExecution.total > 0
          ? 'completed'
          : s.sopExecution.completed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'ipc',
      title: t('execution.ipc'),
      icon: <FlaskConical className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/ipc`,
      phase: 'production',
      description: t('execution.ipcDescription'),
      getStatus: (s) => ({
        completed: s.ipc.completed,
        total: s.ipc.total,
        status: s.ipc.approved === s.ipc.total && s.ipc.total > 0
          ? 'verified'
          : s.ipc.completed === s.ipc.total && s.ipc.total > 0
          ? 'completed'
          : s.ipc.completed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'production-environmental',
      title: 'Environmental Monitoring (Production)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=production`,
      phase: 'production',
      description: 'Record temperature and humidity during production',
      getStatus: (s) => ({
        completed: s.productionEnvironmental.recorded,
        total: s.productionEnvironmental.total,
        status: s.productionEnvironmental.recorded >= s.productionEnvironmental.total && s.productionEnvironmental.total > 0
          ? 'completed'
          : s.productionEnvironmental.recorded > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'production-output',
      title: 'Production Output / Yield',
      icon: <Package className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/production-output`,
      phase: 'post_production',
      description: 'Record actual production quantity and calculate yield',
      getStatus: (s) => ({
        completed: s.productionOutput.recorded ? 1 : 0,
        total: 1,
        status: s.productionOutput.recorded ? 'completed' : 'pending',
      }),
    },
    {
      id: 'post-production-cleaning',
      title: 'Post-Production Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=post_production`,
      phase: 'post_production',
      description: 'Clean room and equipment after production',
      getStatus: (s) => ({
        completed: s.postProductionCleaning.completed,
        total: s.postProductionCleaning.total,
        status: s.postProductionCleaning.verified === s.postProductionCleaning.total && s.postProductionCleaning.total > 0
          ? 'verified'
          : s.postProductionCleaning.completed === s.postProductionCleaning.total && s.postProductionCleaning.total > 0
          ? 'completed'
          : s.postProductionCleaning.completed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'pre-packaging-cleaning',
      title: 'Pre-Packaging Cleaning',
      icon: <Sparkles className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/cleaning?phase=pre_packaging`,
      phase: 'pre_packaging',
      description: 'Verify packaging area cleanliness',
      getStatus: (s) => ({
        completed: s.prePackagingCleaning.completed,
        total: s.prePackagingCleaning.total,
        status: s.prePackagingCleaning.verified === s.prePackagingCleaning.total && s.prePackagingCleaning.total > 0
          ? 'verified'
          : s.prePackagingCleaning.completed === s.prePackagingCleaning.total && s.prePackagingCleaning.total > 0
          ? 'completed'
          : s.prePackagingCleaning.completed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'packaging-weight',
      title: 'Packaging Weight Control',
      icon: <Scale className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/packaging-qc?tab=weight`,
      phase: 'packaging',
      description: 'Sample weight verification during packaging',
      getStatus: (s) => ({
        completed: s.packagingWeight.passed,
        total: s.packagingWeight.total,
        status: s.packagingWeight.passed === s.packagingWeight.total && s.packagingWeight.total > 0
          ? 'completed'
          : s.packagingWeight.passed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'packaging-integrity',
      title: 'Packaging Integrity',
      icon: <Package className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/packaging-qc?tab=integrity`,
      phase: 'packaging',
      description: 'Cap, label, and packing verification',
      getStatus: (s) => ({
        completed: s.packagingIntegrity.passed,
        total: s.packagingIntegrity.total,
        status: s.packagingIntegrity.passed === s.packagingIntegrity.total && s.packagingIntegrity.total > 0
          ? 'completed'
          : s.packagingIntegrity.passed > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'packaging-environmental',
      title: 'Environmental Monitoring (Packaging)',
      icon: <Thermometer className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/environmental-monitoring?phase=packaging`,
      phase: 'packaging',
      description: 'Record temperature and humidity during packaging',
      getStatus: (s) => ({
        completed: s.packagingEnvironmental.recorded,
        total: s.packagingEnvironmental.total,
        status: s.packagingEnvironmental.recorded >= s.packagingEnvironmental.total && s.packagingEnvironmental.total > 0
          ? 'completed'
          : s.packagingEnvironmental.recorded > 0
          ? 'in_progress'
          : 'pending',
      }),
    },
    {
      id: 'finished-inspection',
      title: 'Finished Product Inspection',
      icon: <ClipboardCheck className="h-5 w-5" />,
      href: `/production/work-orders/${workOrderId}/finished-inspection`,
      phase: 'inspection',
      description: '15-point inspection checklist',
      getStatus: (s) => ({
        completed: s.finishedInspection.status === 'passed' ? 1 : 0,
        total: 1,
        status: s.finishedInspection.status === 'passed'
          ? 'completed'
          : s.finishedInspection.status === 'in_progress'
          ? 'in_progress'
          : 'pending',
      }),
    },
  ];

  const renderStatusBadge = (status: 'pending' | 'in_progress' | 'completed' | 'verified') => {
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
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {labels[status]}
      </span>
    );
  };

  const renderProgressBar = (completed: number, total: number) => {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-12 text-right">{completed}/{total}</span>
      </div>
    );
  };

  if (woLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Work Order not found</p>
        <DxButton
          text="Back to Work Orders"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  const defaultSummary: ExecutionSummary = summary || {
    materialWeighing: { total: 0, completed: 0, verified: 0 },
    preProductionCleaning: { total: 0, completed: 0, verified: 0 },
    sopExecution: { total: 0, completed: 0, verified: 0 },
    productionEnvironmental: { total: 0, recorded: 0, normal: 0 },
    productionOutput: { recorded: false, actualQuantity: null, yieldPercent: null },
    postProductionCleaning: { total: 0, completed: 0, verified: 0 },
    prePackagingCleaning: { total: 0, completed: 0, verified: 0 },
    packagingWeight: { total: 0, passed: 0 },
    packagingIntegrity: { total: 0, passed: 0 },
    packagingEnvironmental: { total: 0, recorded: 0, normal: 0 },
    finishedInspection: { status: 'pending' },
    ipc: { total: 0, completed: 0, approved: 0 },
  };

  // Group sections by phase
  const sectionsByPhase = executionSections.reduce((acc, section) => {
    if (!acc[section.phase]) acc[section.phase] = [];
    acc[section.phase].push(section);
    return acc;
  }, {} as Record<string, ExecutionSection[]>);

  const phases = ['pre_production', 'production', 'post_production', 'pre_packaging', 'packaging', 'inspection'] as const;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title={`Execution: ${workOrder.woNumber}`}
        subtitle={`Batch: ${workOrder.batchNumber} | ${workOrder.productName}`}
        icon={ClipboardCheck}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution' },
        ]}
        actions={
          <DxButton
            text="Back to Work Order"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}`)}
          />
        }
      />

      {/* Work Order Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                workOrder.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                workOrder.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {workOrder.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-gray-600">
                Planned: <strong>{workOrder.plannedQuantity}</strong> |
                Actual: <strong>{workOrder.actualQuantity || 0}</strong>
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Progress based on BOM configuration
            </div>
          </div>
        </CardContent>
      </Card>

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
                const sectionStatus = section.getStatus(defaultSummary);

                return (
                  <Link key={section.id} href={section.href}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
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
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>

                        <div className="space-y-2">
                          {renderProgressBar(sectionStatus.completed, sectionStatus.total)}
                          <div className="flex justify-end">
                            {renderStatusBadge(sectionStatus.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Alert for unconfigured BOM */}
      {Object.values(defaultSummary).every(v =>
        typeof v === 'object' && 'total' in v && v.total === 0
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
            <DxButton
              text="Configure BOM"
              type="default"
              onClick={() => {
                // Navigate to BOM configuration
                toast.info('Navigate', 'Please configure the BOM for this product first.');
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
