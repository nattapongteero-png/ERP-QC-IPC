import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  FlaskConical,
  Gauge,
  Play,
  FileText,
  History,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ResponsivePageHeader } from '@/components/shared';
import { IPCLivePreviewCard } from '@/components/master-data/IPCLivePreviewCard';
import { SOFT_PRIMARY_BTN, SOFT_SECONDARY_BTN } from '@/components/shared/soft-form';
import { STEPS, RECORDED, WORK_ORDER, type Step } from '../data/demo-batch';
import { IPCRoundHistory, getNextRetestStage } from '@/components/ipc-recording/IPCRoundHistory';

/**
 * SOP Execution — the same batch as the IPC screen, seen from the SOP side.
 *
 * Two things this is here to make judgeable side by side:
 *
 *  1. The step list as the operator meets it mid-batch — steps behind them
 *     closed, one step live, the rest not yet open — rather than a list where
 *     every row is pending and nothing can be expanded.
 *  2. Closing a step means recording the IPC topics attached to it, and those
 *     recorders are the criteria author's Live Preview, unchanged. So the
 *     operator meets the same surface here as on the IPC screen.
 *
 * Fixed sample data from ../data/demo-batch. Nothing is fetched or written.
 */

// The gradient band the real screen paints per phase.
const PHASE_GRADIENT: Record<string, string> = {
  done: 'from-emerald-500 to-teal-600',
  active: 'from-sky-500 to-blue-600',
  todo: 'from-slate-400 to-slate-500',
};

const STATUS_CHIP = {
  done: { cls: 'bg-emerald-100 text-emerald-700', label: 'COMPLETED' },
  active: { cls: 'bg-amber-100 text-amber-700', label: 'IN PROGRESS' },
  todo: { cls: 'bg-slate-100 text-slate-500', label: 'PENDING' },
};

const ICON_BG = {
  done: 'bg-emerald-500 text-white',
  active: 'bg-sky-500 text-white',
  todo: 'bg-slate-200 text-slate-500',
};

/** Expected process parameters the operator confirms when closing a step. */
const EXPECTED_PARAMS: Record<number, Record<string, string>> = {
  2: { 'เวลาผสม (นาที)': '20', 'ความเร็ว (รอบ/นาที)': '12' },
  3: { 'ความเร็วเครื่องบรรจุ (แคปซูล/ชม.)': '24000', 'อุณหภูมิห้อง (°C)': '24' },
  5: { 'อุณหภูมิหัวผนึก (°C)': '165' },
};

/**
 * The controlled document each step is performed against.
 *
 * On the real screen this is a GMP document id that opens a viewer; here the
 * content is inline so the dialog has something to show.
 */
const STEP_DOC: Record<number, {
  number: string; title: string; version: string; effective: string; body: string[];
}> = {
  1: {
    number: 'SOP-PRD-014', title: 'การเตรียมและตรวจรับวัตถุดิบเข้าไลน์ผลิต',
    version: 'rev.3', effective: '1 ม.ค. 2569',
    body: [
      '1. ตรวจสอบใบเบิกวัตถุดิบว่าได้รับอนุมัติจากคลังแล้ว',
      '2. ตรวจสอบเลขที่รุ่นวัตถุดิบบนภาชนะให้ตรงกับใบเบิกทุกรายการ',
      '3. ตรวจสอบวันหมดอายุ ต้องเหลือไม่น้อยกว่า 6 เดือน',
      '4. ชั่งวัตถุดิบตามสูตร บันทึกน้ำหนักที่ชั่งได้จริง',
      '5. ให้ผู้ตรวจสอบคนที่สองลงนามยืนยันน้ำหนัก',
    ],
  },
  2: {
    number: 'SOP-PRD-014', title: 'การผสมผงยาและควบคุมความชื้น',
    version: 'rev.3', effective: '1 ม.ค. 2569',
    body: [
      '1. ตั้งเครื่องผสมที่ความเร็ว 12 รอบ/นาที',
      '2. ผสมต่อเนื่อง 20 นาที ห้ามเปิดฝาระหว่างผสม',
      '3. เก็บตัวอย่างจาก 3 ตำแหน่งในถัง — บน กลาง ล่าง',
      '4. ส่งตรวจความชื้น ต้องอยู่ในช่วง 3–7%',
      '5. หากความชื้นเกินเกณฑ์ ให้อบต่อและตรวจซ้ำ',
    ],
  },
  3: {
    number: 'SOP-PRD-014', title: 'การบรรจุแคปซูลและควบคุมน้ำหนัก',
    version: 'rev.3', effective: '1 ม.ค. 2569',
    body: [
      '1. ปรับตั้งเครื่องบรรจุที่ความเร็ว 24,000 แคปซูล/ชม.',
      '2. ชั่งแคปซูลเปล่า 10 ชิ้นเพื่อหาค่า Tare ก่อนเริ่มเดินเครื่อง',
      '3. ตรวจน้ำหนักทุก 30 นาที และทุกครั้งที่ปรับตั้งเครื่อง',
      '4. เก็บตัวอย่าง 20 แคปซูล ต่อการตรวจ 1 ครั้ง',
      '5. น้ำหนักยาสุทธิต้องอยู่ในช่วง 370–430 mg ทุกแคปซูล',
      '6. หากพบเกินเกณฑ์ ให้หยุดเครื่องและเปิด Deviation ทันที',
    ],
  },
  4: {
    number: 'SOP-QC-021', title: 'การตรวจสอบลักษณะภายนอกและคัดแยก',
    version: 'rev.2', effective: '15 มี.ค. 2569',
    body: [
      '1. ตรวจด้วยตาเปล่าภายใต้แสงสว่างไม่น้อยกว่า 500 lux',
      '2. คัดแคปซูลที่สีไม่สม่ำเสมอ บุบ แตก หรือฝาหลวมออก',
      '3. บันทึกจำนวนที่คัดออกเทียบกับจำนวนที่ตรวจ',
    ],
  },
  5: {
    number: 'SOP-PKG-008', title: 'การบรรจุซองและปิดผนึก',
    version: 'rev.1', effective: '1 มิ.ย. 2569',
    body: [
      '1. ตั้งอุณหภูมิหัวผนึกที่ 165 °C รอให้อุณหภูมิคงที่',
      '2. ตรวจรอยผนึกทุกครั้งที่เปลี่ยนม้วนฟิล์ม',
      '3. สุ่มตรวจความเรียบร้อยของการปิดผนึก 5 ซองต่อรอบ',
    ],
  },
};

/** Who did what, for the steps already closed. */
const SIGNED: Record<number, { start: string; end: string; by: string }> = {
  1: { start: '19/8/2569 08:12', end: '19/8/2569 08:47', by: 'สมชาย ผลิตดี' },
  2: { start: '19/8/2569 08:50', end: '19/8/2569 09:31', by: 'สมชาย ผลิตดี' },
};
const STARTED: Record<number, string> = { 3: '19/8/2569 09:35' };

/**
 * One dialog shell for all three: sticky header, one scrolling band, sticky
 * footer. The old screen expanded these inline, which pushed the rest of the
 * step list down and lost the operator's place — a dialog leaves the list where
 * it was.
 */
function Modal({
  title, subtitle, testId, onClose, footer, children,
}: {
  title: string;
  subtitle?: string;
  testId: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid={testId}
    >
      <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]">
        <div className="flex shrink-0 items-start gap-3 border-b border-[#f1f3f5] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-black">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-[#bfbfbf]">{subtitle}</p>}
          </div>
          <button
            type="button" aria-label="ปิด" onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-[#f1f3f5] hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-[#f5f6f8] px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f1f3f5] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The controlled document the step is performed against. */
function DocDialog({ step, onClose }: { step: Step; onClose: () => void }) {
  const doc = STEP_DOC[step.seq];
  if (!doc) return null;
  return (
    <Modal
      title="เอกสารควบคุม (SOP)"
      subtitle={`ขั้นตอนที่ ${step.seq}: ${step.title}`}
      testId="sop-doc-dialog"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={SOFT_SECONDARY_BTN}>ปิด</button>}
    >
      <div className="rounded-[16px] bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#e8effc] px-2 py-0.5 font-mono text-[11px] font-bold text-[#3559b0]">
            {doc.number}
          </span>
          <span className="rounded-md bg-[#f1f3f5] px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {doc.version}
          </span>
          <span className="text-[11px] text-[#bfbfbf]">มีผลบังคับใช้ {doc.effective}</span>
        </div>
        <p className="mt-3 text-[15px] font-bold text-slate-900">{doc.title}</p>
        <ol className="mt-4 flex flex-col gap-2">
          {doc.body.map((line) => (
            <li key={line} className="text-[13px] leading-relaxed text-slate-700">{line}</li>
          ))}
        </ol>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-[#bfbfbf]">
        เอกสารฉบับควบคุม — ห้ามแก้ไขจากหน้านี้ การแก้ไขต้องผ่านระบบควบคุมเอกสาร GMP
      </p>
    </Modal>
  );
}

/** Rounds already recorded against this step's IPC topics. */
function RecordedDialog({ step, onClose }: { step: Step; onClose: () => void }) {
  const recordedTopics = step.ipc.filter((c) => {
    const r = RECORDED[c.criteriaId];
    return !!r?.recordedTestId && !!r.recordedSamples?.length;
  });
  return (
    <Modal
      title="ผลที่บันทึกไว้แล้ว"
      subtitle={`ขั้นตอนที่ ${step.seq}: ${step.title}`}
      testId="sop-recorded-dialog"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={SOFT_SECONDARY_BTN}>ปิด</button>}
    >
      {recordedTopics.length === 0 ? (
        <div className="rounded-[16px] bg-white px-4 py-6 text-center text-[13px] text-slate-500">
          ยังไม่มีผลบันทึกในขั้นตอนนี้
        </div>
      ) : (
        recordedTopics.map((c) => (
          <div key={c.criteriaId} className="rounded-[16px] bg-white p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#e8effc] px-2 py-0.5 font-mono text-[11px] font-bold text-[#3559b0]">
                {c.formData.code}
              </span>
              <span className="text-sm font-semibold text-black">{c.formData.name}</span>
              {c.formData.isCritical && (
                <span className="rounded-md bg-[#fbeceb] px-2 py-0.5 text-[10px] font-bold text-[#c0362c]">
                  CRITICAL
                </span>
              )}
            </div>
            <IPCRoundHistory ipc={RECORDED[c.criteriaId]} />
          </div>
        ))
      )}
      <p className="px-1 text-[11px] leading-relaxed text-[#bfbfbf]">
        ผลที่ลงนามแล้วแก้ไขไม่ได้ — หากต้องบันทึกใหม่ ระบบจะเปิดเป็นรอบถัดไปตามสิทธิ์ทดสอบซ้ำ
      </p>
    </Modal>
  );
}

function StepDialog({ step, onClose }: { step: Step; onClose: () => void }) {
  const params = EXPECTED_PARAMS[step.seq];

  return (
    <Modal
      title="ปิดขั้นตอนและบันทึกผล"
      subtitle={`${WORK_ORDER.woNumber} · รุ่นการผลิต ${WORK_ORDER.batchNumber}`}
      testId="sop-complete-dialog"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={SOFT_SECONDARY_BTN}>ยกเลิก</button>
          <button
            type="button" onClick={onClose} className={SOFT_PRIMARY_BTN}
            data-testid="sop-complete-submit"
          >
            บันทึกและปิดขั้นตอนที่ {step.seq}
          </button>
        </>
      }
    >
      <>
          {/* Which step is being closed. */}
          <div className={cn('rounded-[16px] bg-gradient-to-br p-4 text-white', PHASE_GRADIENT.active)}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/80">
              Complete step
            </p>
            <p className="text-lg font-bold leading-snug">
              ขั้นตอนที่ {step.seq}: {step.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/90">{step.detail}</p>
          </div>

          {params && (
            <div className="rounded-[16px] bg-white p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <Gauge className="h-3.5 w-3.5" />
                บันทึกค่าที่ทำได้จริง
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(params).map(([label, expected]) => (
                  <label key={label} className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      {label} <span className="font-normal text-slate-400">(ตามแผน: {expected})</span>
                    </span>
                    <input
                      defaultValue={expected}
                      className="h-10 w-full rounded-[12px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium text-slate-900 outline-none transition focus:ring-2 focus:ring-[#5682e9]/30"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step.ipc.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-black">
                <FlaskConical className="h-4 w-4 text-slate-400" />
                หัวข้อควบคุมคุณภาพที่ต้องบันทึกก่อนปิดขั้นตอน ({step.ipc.length})
              </p>

              {step.ipc.map((c) => {
                const recorded = RECORDED[c.criteriaId];
                const hasRounds = !!recorded?.recordedTestId && !!recorded.recordedSamples?.length;
                const retestNext = recorded ? getNextRetestStage(recorded) : null;
                const round = hasRounds ? retestNext?.nextRound ?? null : 1;

                return (
                  <div key={c.criteriaId} className="flex flex-col gap-3">
                    {c.formData.isCritical && (
                      <div className="flex items-start gap-2 rounded-[12px] border border-[#f3c7c2] bg-[#fbeceb] px-3 py-2.5">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#c0362c]" />
                        <p className="text-[11px] leading-relaxed text-[#8f2b23]">
                          <strong className="font-semibold">{c.formData.code} เป็นเกณฑ์วิกฤต</strong> —
                          ไม่มีสิทธิ์ทดสอบซ้ำ หากผลไม่ผ่านต้องเปิด Deviation
                        </p>
                      </div>
                    )}

                    {round !== null ? (
                      /* Identical to the IPC screen: the author's Live Preview. */
                      <IPCLivePreviewCard
                        formData={c.formData}
                        criteriaType={c.criteriaType}
                        calculatedMinMax={c.calculatedMinMax}
                        acceptanceMath={c.acceptanceMath}
                        multiStageEnabled={c.multiStageEnabled}
                        stages={c.stages}
                        specPayload={c.specPayload}
                        stage={c.stage}
                      />
                    ) : (
                      <div className="rounded-[12px] border border-[#e1e4e8] bg-white px-3 py-3 text-[11px] leading-relaxed text-slate-600">
                        {c.formData.code} — บันทึกครบตามสิทธิ์แล้ว ผลที่ลงนามแล้วแก้ไขไม่ได้
                      </div>
                    )}

                    {hasRounds && recorded && (
                      <div className="rounded-[16px] bg-white p-4">
                        <p className="mb-1 text-sm font-semibold text-black">
                          ประวัติการบันทึก — {c.formData.code}
                        </p>
                        <IPCRoundHistory ipc={recorded} />
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <label className="block rounded-[16px] bg-white p-4">
            <span className="mb-1 block text-xs font-medium text-slate-600">หมายเหตุ</span>
            <textarea
              rows={2}
              placeholder="เช่น ปรับตั้งเครื่องระหว่างรอบ / พบสิ่งผิดปกติ"
              className="w-full rounded-[12px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-[#bfbfbf] focus:ring-2 focus:ring-[#5682e9]/30"
            />
          </label>
      </>
    </Modal>
  );
}

export function SopExecutionDemo({ onBack }: { onBack?: () => void }) {
  const [openStep, setOpenStep] = React.useState<Step | null>(null);
  const [docStep, setDocStep] = React.useState<Step | null>(null);
  const [recordedStep, setRecordedStep] = React.useState<Step | null>(null);

  /** Whether this step has any IPC round already on file. */
  const hasRecorded = (step: Step) =>
    step.ipc.some((c) => {
      const r = RECORDED[c.criteriaId];
      return !!r?.recordedTestId && !!r.recordedSamples?.length;
    });
  const doneCount = STEPS.filter((s) => s.status === 'done').length;

  return (
    <div className="box-border flex w-full max-w-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <ResponsivePageHeader
        title="SOP Execution"
        subtitle={`${WORK_ORDER.woNumber} | Batch: ${WORK_ORDER.batchNumber}`}
        icon={ClipboardList}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={onBack}
      />

      {/* Progress banner — the real screen's green gradient block. */}
      <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              All phases · In progress
            </p>
            <p className="mt-1 font-mono text-2xl font-bold">{WORK_ORDER.woNumber}</p>
            <p className="mt-1 text-sm text-white/90">
              {WORK_ORDER.productName} · Batch{' '}
              <span className="font-mono font-semibold">{WORK_ORDER.batchNumber}</span>
            </p>
          </div>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-3xl font-bold leading-none">
                {doneCount}
                <span className="text-lg text-white/60">/{STEPS.length}</span>
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/70">Completed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none text-white/60">
                0<span className="text-lg text-white/40">/{STEPS.length}</span>
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/70">Verified</p>
            </div>
          </div>
        </div>
        <div className="relative mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full bg-white/80"
              style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-white/70">
            <span>0% verified</span>
            <span>{Math.round((doneCount / STEPS.length) * 100)}% completed</span>
          </div>
        </div>
      </div>

      {/* Step list */}
      <div className="rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-3">
          {STEPS.map((step) => {
            const chip = STATUS_CHIP[step.status];
            const signed = SIGNED[step.seq];
            return (
              <div
                key={step.seq}
                className={cn(
                  'flex flex-wrap items-start gap-3 rounded-[14px] border p-4',
                  step.status === 'active'
                    ? 'border-amber-300 bg-amber-50/40'
                    : 'border-[#eef0f2] bg-white',
                )}
              >
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ICON_BG[step.status])}>
                    {step.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-slate-900">
                        ขั้นตอนที่ {step.seq}: {step.title}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', chip.cls)}>
                        {chip.label}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        <UserCheck className="h-2.5 w-2.5" />
                        ต้องมีผู้ตรวจสอบ
                      </span>
                      {step.ipc.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                          <FlaskConical className="h-2.5 w-2.5" />
                          IPC {step.ipc.length}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] text-slate-500">{step.detail}</p>
                    {signed && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        เริ่ม: {signed.start} โดย {signed.by} · เสร็จ: {signed.end} โดย {signed.by}
                      </p>
                    )}
                    {STARTED[step.seq] && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        เริ่ม: {STARTED[step.seq]} โดย สมชาย ผลิตดี
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {STEP_DOC[step.seq] && (
                        <button
                          type="button"
                          data-testid={`sop-doc-${step.seq}`}
                          onClick={() => setDocStep(step)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e4e8] bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-[#9db9e8] hover:text-[#2f6fd0]"
                        >
                          <FileText className="h-3 w-3" />
                          ดูเอกสาร SOP · {STEP_DOC[step.seq].number}
                        </button>
                      )}
                      {hasRecorded(step) && (
                        <button
                          type="button"
                          data-testid={`sop-recorded-${step.seq}`}
                          onClick={() => setRecordedStep(step)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e4e8] bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-[#9db9e8] hover:text-[#2f6fd0]"
                        >
                          <History className="h-3 w-3" />
                          ดูผลที่บันทึกแล้ว
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 self-center">
                    {step.status === 'done' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700">
                        <Clock className="h-3 w-3" />
                        รอผู้ตรวจสอบคนอื่น
                      </span>
                    )}
                    {step.status === 'active' && (
                      <button
                        type="button"
                        data-testid={`sop-complete-${step.seq}`}
                        onClick={() => setOpenStep(step)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        ปิดขั้นตอน
                      </button>
                    )}
                    {step.status === 'todo' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f3f5] px-3 py-1.5 text-[11px] font-medium text-slate-400">
                        <Play className="h-3 w-3" />
                        ยังไม่ถึงคิว
                      </span>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      </div>

      {openStep && <StepDialog step={openStep} onClose={() => setOpenStep(null)} />}
      {docStep && <DocDialog step={docStep} onClose={() => setDocStep(null)} />}
      {recordedStep && <RecordedDialog step={recordedStep} onClose={() => setRecordedStep(null)} />}
    </div>
  );
}

export default SopExecutionDemo;
