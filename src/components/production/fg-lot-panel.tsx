'use client';

import { useState, Fragment } from 'react';
import type { ReactNode } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox, parseStringToDate } from '@/components/ui/dx-date-box';
import { formatNumber } from '@/lib/utils/number-format';

/**
 * The three identifiers the finished-goods lot will carry, shown on the card
 * where that lot is actually created, so a wrong one is caught before it is
 * printed onto a label rather than after.
 *
 * None of it is typed in: the lot number is the work order's own batch number,
 * the manufacturing date is the day production actually started, and the expiry
 * is that date plus the product's shelf life. Each one says where it came from,
 * because a figure a reader cannot trace is a figure they cannot check.
 *
 * A wrong value can be corrected here — production output already accepts an
 * MFD and an expiry override, and this is where someone would notice one is
 * needed. The correction is not yet persisted; the panel says so.
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
  label, value, caption, edited,
}: {
  label: string;
  value: string;
  caption: ReactNode;
  edited?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-[#9aa3ad]">{label}</div>
      <div
        className={
          'mt-0.5 font-mono text-[14px] font-semibold ' +
          (value === '—' ? 'text-[#c2410c]' : 'text-slate-900')
        }
      >
        {value}
        {edited ? (
          <span className="ml-1.5 rounded bg-[#fff4e6] px-1 py-0.5 font-sans text-[10px] font-medium text-[#c2410c]">
            แก้ไขแล้ว
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[#9aa3ad]">{caption}</div>
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
    <div className="mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700">ข้อมูลล็อตสินค้าสำเร็จรูป</span>
          <span className="rounded-full bg-[#e8effc] px-2 py-0.5 text-[10px] font-medium text-[#3559b0]">
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
                className="text-[12px] text-[#6b7684] underline-offset-2 hover:underline"
              >
                คืนค่าที่ระบบคำนวณ
              </button>
            ) : null}
            <DxButton text="แก้ไข" icon="edit" stylingMode="outlined" onClick={openEditor} />
          </div>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
          <LotField
            label="เลขล็อต"
            value={shown.lot || '—'}
            caption="ใช้เลขแบทช์ของใบสั่งผลิตนี้"
            edited={changed('lot')}
          />
          <LotField
            label="วันผลิต (MFD)"
            value={showDate(shown.mfd)}
            caption={changed('mfd') ? 'กำหนดเอง' : mfdSourceLabel(workOrder)}
            edited={changed('mfd')}
          />
          <LotField
            label="วันหมดอายุ (EXP)"
            value={showDate(shown.exp)}
            caption={changed('exp') ? 'กำหนดเอง' : expiryCaption}
            edited={changed('exp')}
          />
        </div>
      ) : null}

      {/* MOCKUP: what the expiry would come out as, worked out on screen from
          this work order's own manufacturing date. Shown only while the product
          carries no shelf life — the real field above stays blank, because a
          date with nothing behind it does not belong on a batch record, and an
          example clearly labelled as one is not that date. Nothing is saved. */}
      {!editing && !shelfLife && shown.mfd ? (
        <div className="mt-2.5 rounded-[10px] border border-[#cfe0f7] bg-[#f4f8fe] px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-[#fff4e6] px-1.5 py-0.5 text-[10px] font-bold text-[#c2410c]">
              MOCKUP
            </span>
            <span className="text-[11px] text-[#6b7684]">
              ตัวอย่าง — ถ้าตั้งอายุการเก็บของสินค้าไว้ วันหมดอายุจะออกมาแบบนี้
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {[365, 730, 1095].map((days, i) => (
              <Fragment key={days}>
                {i > 0 ? <span className="text-[#d5d8dc]">·</span> : null}
                <span className="text-[11px] text-[#6b7684]">
                  {formatNumber(days)} วัน →{' '}
                  <span className="font-mono text-[12px] font-semibold text-[#3559b0]">
                    {showDate(addDays(shown.mfd, days))}
                  </span>
                </span>
              </Fragment>
            ))}
          </div>
          <div className="mt-1 text-[10px] leading-snug text-[#9aa3ad]">
            คิดจากวันผลิตของใบสั่งผลิตนี้ · ยังไม่บันทึกลงระบบ ·
            ตั้งอายุการเก็บจริงได้ที่ ข้อมูลหลัก › สินค้า › อายุการเก็บ (วัน)
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="mt-2.5 space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <span className="text-[11px] text-[#9aa3ad]">เลขล็อต</span>
              <div className="mt-1">
                <DxTextBox
                  value={draft.lot}
                  onValueChange={(v) => setDraft((d) => ({ ...d, lot: v ?? '' }))}
                  labelMode="hidden"
                />
              </div>
            </div>
            <div>
              <span className="text-[11px] text-[#9aa3ad]">วันผลิต (MFD)</span>
              <div className="mt-1">
                <DxDateBox
                  value={draft.mfd}
                  labelMode="hidden"
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      mfd: v ?? '',
                      // Expiry follows the manufacturing date unless it was set
                      // by hand — otherwise correcting the MFD silently leaves
                      // an expiry that no longer belongs to it.
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
              <span className="text-[11px] text-[#9aa3ad]">วันหมดอายุ (EXP)</span>
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
          <p className="text-[11px] leading-relaxed text-[#c2410c]">
            การแก้ไขนี้ยังไม่ถูกบันทึกลงระบบ — แสดงบนหน้าจอนี้เท่านั้น และจะหายเมื่อโหลดหน้าใหม่
          </p>
          <div className="flex items-center gap-2">
            <DxButton
              text="ใช้ค่านี้"
              type="default"
              stylingMode="contained"
              onClick={() => {
                setOverride(draft);
                setEditing(false);
              }}
            />
            <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => setEditing(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FgLotPanel;
