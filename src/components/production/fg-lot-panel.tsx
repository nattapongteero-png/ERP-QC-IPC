'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Package, Pencil } from 'lucide-react';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox, parseStringToDate } from '@/components/ui/dx-date-box';
import { SOFT_PRIMARY_BTN, SOFT_SECONDARY_BTN, SOFT_WARN } from '@/components/shared/soft-form';
import { formatNumber } from '@/lib/utils/number-format';

/**
 * The three identifiers the finished-goods lot will carry, shown on the
 * packaging screen so a wrong one is caught before it is printed onto a label
 * rather than after.
 *
 * None of it is typed in: the lot number is the work order's own batch number,
 * the manufacturing date is the day production actually started, and the expiry
 * is that date plus the product's shelf life. Each one says where it came from,
 * because a figure a reader cannot trace is a figure they cannot check.
 *
 * A wrong value can be corrected here — production output already accepts an
 * MFD and an expiry override, and this is where someone would notice one is
 * needed. The correction is not yet persisted; the panel says so.
 *
 * Styling follows the step sections above it — a grey caption row over a
 * #f9fafb panel, pill actions — rather than inventing a third look for the
 * same screen.
 */
export interface FgLotSource {
  batchNumber?: string | null;
  productShelfLifeDays?: number | null;
  projectedMfd?: string | null;
  projectedExpiry?: string | null;
  actualStartDate?: string | null;
  plannedStartDate?: string | null;
}

const SHOW_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** Mirrors calculateExpiryDate in lib/db/date-utils, which cannot be imported
 *  here — it reaches for the database connection to pick a date format. */
function addDays(isoDate: string | null | undefined, days: number | null | undefined): string | null {
  if (!isoDate || !days) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function showDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('th-TH', SHOW_DATE);
}

/** Same order of preference the server used, so the caption names the date the
 *  operator can actually go and check. */
function mfdSourceLabel(wo: FgLotSource): string {
  const sameDay = (a?: string | null) =>
    !!a && !!wo.projectedMfd && new Date(a).toISOString().split('T')[0] === wo.projectedMfd;
  if (sameDay(wo.actualStartDate)) return 'วันที่เริ่มผลิตจริง';
  if (sameDay(wo.plannedStartDate)) return 'ยังไม่เริ่มผลิต — ใช้วันเริ่มตามแผน';
  return 'ยังไม่มีวันเริ่มผลิต — ใช้วันที่วันนี้';
}

function LotField({
  label, value, caption, missing, edited,
}: {
  label: string;
  value: string;
  caption: ReactNode;
  missing?: boolean;
  edited?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-[#bfbfbf]">{label}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span
          className={
            'text-[13px] font-medium ' + (missing ? 'text-[#c2410c]' : 'font-mono text-slate-900')
          }
        >
          {value}
        </span>
        {edited ? (
          <span className="rounded-full bg-[#fff4e6] px-2 py-0.5 text-[10px] font-medium text-[#c2410c]">
            แก้ไขแล้ว
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{caption}</div>
    </div>
  );
}

export function FgLotPanel({ workOrder }: { workOrder: FgLotSource }) {
  // Null until someone corrects a value; the system's own figure is used until
  // then, so a later refresh of the work order still moves the display.
  const [override, setOverride] = useState<{ lot: string; mfd: string; exp: string } | null>(null);
  const [editing, setEditing] = useState(false);

  // Shelf life is what turns a manufacturing date into an expiry. Without it
  // there is no expiry to show and none may be invented — an unsupported date
  // on a batch record is a worse outcome than a blank one.
  const shelfLife = workOrder.productShelfLifeDays ?? null;

  const system = {
    lot: workOrder.batchNumber ?? '',
    mfd: workOrder.projectedMfd ?? '',
    // The server projects this too. Falling back to the same sum keeps the date
    // and the caption below it telling the same story: a caption that recites a
    // formula next to a blank date is the screen calling itself a liar.
    exp: workOrder.projectedExpiry ?? addDays(workOrder.projectedMfd, shelfLife) ?? '',
  };
  const shown = override ?? system;
  // "Edited" has to mean the value actually differs, or an override that happens
  // to equal the system figure labels an untouched date "กำหนดเอง".
  const changed = (k: keyof typeof system) => !!override && override[k] !== system[k];
  const anyChanged = changed('lot') || changed('mfd') || changed('exp');

  const [draft, setDraft] = useState(shown);
  const openEditor = () => {
    setDraft(shown);
    setEditing(true);
  };

  const expiryCaption = shelfLife
    ? `วันผลิต + อายุการเก็บ ${formatNumber(shelfLife)} วัน`
    : 'สินค้านี้ยังไม่ได้ตั้งอายุการเก็บ จึงคำนวณวันหมดอายุไม่ได้';

  return (
    <div className="mt-4 border-t border-[#eef0f2] pt-4">
      {/* Caption row, the same one the step sections on this screen use. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-medium text-[#bfbfbf]">ข้อมูลล็อตสินค้าสำเร็จรูป</span>
          <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-medium text-[#2f6fd0]">
            ระบบคำนวณให้
          </span>
          {anyChanged ? (
            <span className="rounded-full bg-[#fff4e6] px-2 py-0.5 text-[10px] font-medium text-[#c2410c]">
              ยังไม่บันทึกลงระบบ
            </span>
          ) : null}
        </div>
        {!editing ? (
          <div className="flex items-center gap-3">
            {anyChanged ? (
              <button
                type="button"
                onClick={() => setOverride(null)}
                className="text-[12px] text-[#bfbfbf] transition hover:text-[#2f6fd0]"
              >
                คืนค่าที่ระบบคำนวณ
              </button>
            ) : null}
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e4e8] bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-[#9db9e8] hover:text-[#2f6fd0]"
            >
              <Pencil className="h-3.5 w-3.5" />
              แก้ไข
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-[12px] bg-[#f9fafb] p-3">
        {!editing ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <LotField
              label="เลขล็อต"
              value={shown.lot || '—'}
              missing={!shown.lot}
              caption="ใช้เลขแบทช์ของใบสั่งผลิตนี้"
              edited={changed('lot')}
            />
            <LotField
              label="วันผลิต (MFD)"
              value={showDate(shown.mfd)}
              missing={!shown.mfd}
              caption={changed('mfd') ? 'กำหนดเอง' : mfdSourceLabel(workOrder)}
              edited={changed('mfd')}
            />
            <LotField
              label="วันหมดอายุ (EXP)"
              value={showDate(shown.exp)}
              missing={!shown.exp}
              caption={changed('exp') ? 'กำหนดเอง' : expiryCaption}
              edited={changed('exp')}
            />
          </div>
        ) : (
          <div className="fg-lot-fields space-y-3">
            {/* The DevExtreme editors draw their own outlined box. Scoped here
                so they wear the pale filled field the criteria screen
                introduced, rather than a second field style on one screen. */}
            <style>{`
              /* !important because the app's own DevExtreme theme sets these
                 on the same class and would otherwise win. */
              .fg-lot-fields .dx-texteditor {
                background: #f1f3f5 !important;
                border: none !important;
                border-radius: 10px !important;
                box-shadow: none !important;
              }
              /* The filled variant paints its own underline on focus/hover. */
              .fg-lot-fields .dx-texteditor::before,
              .fg-lot-fields .dx-texteditor::after {
                display: none;
              }
              .fg-lot-fields .dx-texteditor.dx-state-focused {
                box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
              }
              .fg-lot-fields .dx-texteditor-input {
                background: transparent;
                padding: 10px 12px;
                min-height: 0;
                font-size: 14px;
                color: #0f172a;
              }
              .fg-lot-fields .dx-placeholder::before { padding: 10px 12px; color: #bfbfbf; }
            `}</style>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <span className="text-[11px] text-[#bfbfbf]">เลขล็อต</span>
                <div className="mt-1">
                  <DxTextBox
                    value={draft.lot}
                    onValueChange={(v) => setDraft((d) => ({ ...d, lot: v ?? '' }))}
                    labelMode="hidden"
                  />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[#bfbfbf]">วันผลิต (MFD)</span>
                <div className="mt-1">
                  <DxDateBox
                    value={draft.mfd}
                    labelMode="hidden"
                    onValueChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        mfd: v ?? '',
                        // Expiry follows the manufacturing date unless it was
                        // set by hand — otherwise correcting the MFD silently
                        // leaves an expiry that no longer belongs to it.
                        exp:
                          d.exp === system.exp || d.exp === addDays(d.mfd, shelfLife)
                            ? (addDays(v ?? '', shelfLife) ?? d.exp)
                            : d.exp,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[#bfbfbf]">วันหมดอายุ (EXP)</span>
                <div className="mt-1">
                  <DxDateBox
                    value={draft.exp}
                    labelMode="hidden"
                    min={parseStringToDate(draft.mfd) ?? undefined}
                    onValueChange={(v) => setDraft((d) => ({ ...d, exp: v ?? '' }))}
                  />
                </div>
              </div>
            </div>
            <p className={SOFT_WARN}>
              การแก้ไขนี้ยังไม่ถูกบันทึกลงระบบ — แสดงบนหน้าจอนี้เท่านั้น และจะหายเมื่อโหลดหน้าใหม่
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={SOFT_PRIMARY_BTN}
                onClick={() => {
                  setOverride(draft);
                  setEditing(false);
                }}
              >
                ใช้ค่านี้
              </button>
              <button type="button" className={SOFT_SECONDARY_BTN} onClick={() => setEditing(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default FgLotPanel;
