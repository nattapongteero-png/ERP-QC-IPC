import * as React from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Droplets,
  FlaskConical,
  Lock,
  Package,
  Scale,
  Wind,
} from 'lucide-react';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { formatNumber } from '@/lib/utils/number-format';

/**
 * ใบสั่งผลิต → ดำเนินการผลิต — the card board, drawn with the app's own
 * chrome so the IPC change can be judged where it actually lands.
 *
 * The markup follows ExecutionDashboard: phase pill, two-column card grid,
 * dual-layer progress bar (sky = recorded, emerald = verified), status badge,
 * lock banner. Reproduced rather than imported because the real dashboard is
 * driven end-to-end by /api/production/… and a review build has no work order
 * to drive it with.
 */

const PHASE_COLORS: Record<string, string> = {
  pre_production: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  production: 'bg-sky-100 text-sky-800 border-sky-200',
  post_production: 'bg-amber-100 text-amber-800 border-amber-200',
};

const PHASE_LABEL: Record<string, string> = {
  pre_production: 'ก่อนการผลิต',
  production: 'ระหว่างการผลิต',
  post_production: 'หลังการผลิต',
};

type CardStatus = 'pending' | 'in_progress' | 'completed' | 'verified';

interface Section {
  id: string;
  phase: keyof typeof PHASE_LABEL;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: number;
  verified: number;
  total: number;
  status: CardStatus;
  /** Set when this card is the one the demo drills into. */
  goesTo?: 'ipc';
  lockReason?: string;
}

const SECTIONS: Section[] = [
  {
    id: 'material-requisition',
    phase: 'pre_production',
    title: 'ใบเบิกวัตถุดิบ',
    description: 'เบิกวัตถุดิบตามสูตรจากคลัง',
    icon: <Package className="h-5 w-5 text-emerald-700" />,
    completed: 6, verified: 6, total: 6, status: 'verified',
  },
  {
    id: 'pre-cleaning',
    phase: 'pre_production',
    title: 'ทำความสะอาดก่อนการผลิต',
    description: 'Line clearance และบันทึกการทำความสะอาด',
    icon: <Droplets className="h-5 w-5 text-emerald-700" />,
    completed: 3, verified: 3, total: 3, status: 'verified',
  },
  {
    id: 'material-weighing',
    phase: 'pre_production',
    title: 'ชั่งวัตถุดิบ',
    description: 'ชั่งและตรวจสอบน้ำหนักวัตถุดิบแต่ละรายการ',
    icon: <Scale className="h-5 w-5 text-emerald-700" />,
    completed: 6, verified: 6, total: 6, status: 'verified',
  },
  {
    id: 'sop-execution-production',
    phase: 'production',
    title: 'ปฏิบัติตาม SOP — ระหว่างการผลิต',
    description: 'บันทึกการปฏิบัติงานตามขั้นตอนใน SOP',
    icon: <ClipboardList className="h-5 w-5 text-sky-700" />,
    completed: 2, verified: 2, total: 5, status: 'in_progress',
  },
  {
    id: 'ipc-production',
    phase: 'production',
    title: 'ควบคุมคุณภาพระหว่างการผลิต — ระหว่างการผลิต',
    description: 'บันทึกผลการตรวจสอบคุณภาพระหว่างการผลิต',
    icon: <FlaskConical className="h-5 w-5 text-sky-700" />,
    completed: 2, verified: 1, total: 6, status: 'in_progress',
    goesTo: 'ipc',
  },
  {
    id: 'production-environmental',
    phase: 'production',
    title: 'ตรวจสภาพแวดล้อมระหว่างการผลิต',
    description: 'อุณหภูมิ ความชื้น และความดันต่างห้อง',
    icon: <Wind className="h-5 w-5 text-sky-700" />,
    completed: 4, verified: 0, total: 4, status: 'completed',
  },
  {
    id: 'bulk-product-yield',
    phase: 'post_production',
    title: 'ผลผลิตกึ่งสำเร็จรูป (Bulk Yield)',
    description: 'บันทึกน้ำหนักและคำนวณ % Yield',
    icon: <ClipboardCheck className="h-5 w-5 text-amber-700" />,
    completed: 0, verified: 0, total: 1, status: 'pending',
    lockReason: 'ต้องบันทึก Production ให้ครบก่อน',
  },
];

const BADGE: Record<CardStatus, { cls: string; label: string; icon: React.ReactNode }> = {
  pending: { cls: 'bg-gray-100 text-gray-600', label: 'รอดำเนินการ', icon: <Clock className="h-3 w-3" /> },
  in_progress: { cls: 'bg-amber-100 text-amber-700', label: 'กำลังดำเนินการ', icon: <Clock className="h-3 w-3" /> },
  completed: { cls: 'bg-green-100 text-green-700', label: 'บันทึกแล้ว', icon: <CheckCircle2 className="h-3 w-3" /> },
  verified: { cls: 'bg-emerald-100 text-emerald-700', label: 'ตรวจสอบแล้ว', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const PHASE_ICON_BG: Record<string, string> = {
  pre_production: 'bg-emerald-100',
  production: 'bg-sky-100',
  post_production: 'bg-amber-100',
};

function ProgressBar({ completed, verified, total }: { completed: number; verified: number; total: number }) {
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const verifiedPct = total > 0 ? (verified / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div className="absolute inset-y-0 left-0 bg-sky-500" style={{ width: `${completedPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${verifiedPct}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-gray-500">{completed}/{total}</span>
    </div>
  );
}

export function WorkOrderExecutionDemo({ onOpenIpc }: { onOpenIpc: () => void }) {
  const phases = ['pre_production', 'production', 'post_production'] as const;

  return (
    <div className="box-border flex w-full max-w-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <ResponsivePageHeader
        title="ดำเนินการผลิต: WO-2568-0142"
        subtitle="Batch: B25-0142 | ฟ้าทะลายโจรแคปซูล 400 mg"
        icon={ClipboardCheck}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: 'WO-2568-0142', href: '/production/work-orders/142' },
          { label: 'Execution' },
        ]}
        actions={<DxButton text="Back to Work Order" icon="back" stylingMode="outlined" />}
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                IN PROGRESS
              </span>
              <span className="text-gray-600">
                Planned: <strong>{formatNumber(50000)}</strong> | Actual:{' '}
                <strong>{formatNumber(31200)}</strong>
              </span>
            </div>
            <div className="text-sm text-[#4B7163]">Progress based on BOM configuration</div>
          </div>
        </CardContent>
      </Card>

      {phases.map((phase) => {
        const sections = SECTIONS.filter((s) => s.phase === phase);
        return (
          <div key={phase} className="space-y-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${PHASE_COLORS[phase]}`}
            >
              {PHASE_LABEL[phase]}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sections.map((s) => {
                const locked = !!s.lockReason;
                const clickable = !!s.goesTo && !locked;
                const badge = BADGE[s.status];
                return (
                  <div
                    key={s.id}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    data-testid={`exec-card-${s.id}`}
                    onClick={clickable ? onOpenIpc : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') onOpenIpc();
                          }
                        : undefined
                    }
                  >
                    <Card
                      className={`h-full transition-shadow ${
                        locked ? 'opacity-50' : 'cursor-pointer hover:shadow-md'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-lg p-2 ${PHASE_ICON_BG[s.phase]}`}>{s.icon}</div>
                            <div>
                              <h3 className="font-medium text-gray-900">{s.title}</h3>
                              <p className="text-sm text-gray-500">{s.description}</p>
                            </div>
                          </div>
                          {locked ? (
                            <Lock className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ArrowRight className="h-5 w-5 text-gray-400" />
                          )}
                        </div>

                        {locked ? (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {s.lockReason}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <ProgressBar completed={s.completed} verified={s.verified} total={s.total} />
                            <div className="flex justify-end">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                              >
                                {badge.icon}
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WorkOrderExecutionDemo;
