'use client';

/**
 * IPCLivePreviewCard — the Live Preview shown beside the QC & IPC criteria
 * form. Figma node 8:4886.
 *
 * The card mirrors what the operator will meet on the recording screen, so the
 * person writing the criterion can see the consequence of every field before
 * saving. It is a self-contained mock: the sample values are demo data
 * generated in the browser, nothing here reads or writes the database.
 *
 * The recording layouts follow the templates in the QC/IPC recording mockup —
 * per-unit grid, aggregate value, before/after, tare (average and matched
 * pair), checklist, microbial count and pass/fail — while the visual design
 * (radii, fills, type scale, stat cards, footer) comes from Figma.
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/number-format';
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DOSAGE_FORM_OPTIONS,
  testsForStage,
  type CriteriaType,
} from '@/lib/master-data/ipc-test-catalog';
import {
  STAGE_OPTIONS,
  type SpecPayload,
  type StageValue,
} from '@/lib/master-data/ipc-spec-payload';
import type { AcceptanceStage } from '@/lib/master-data/ipc-stages';

// ── Figma tokens ───────────────────────────────────────────────────
// Darkest at the bottom, white at the top. The white tiles and the record
// surface sit low in the card, so they need the tint underneath them to
// read at all. The bottom colour also carries the pass/fail verdict.
const CARD =
  'overflow-clip rounded-[24px] bg-gradient-to-t to-white transition-colors ' +
  'shadow-[0_4px_8px_rgba(0,0,0,0.1)]';

/** Bottom colour of the card gradient, by verdict. */
const CARD_TINT = {
  neutral: 'from-[#f1f3f5]',
  pass: 'from-[#d8f0e2]',
  fail: 'from-[#f8dcd9]',
} as const;

/**
 * The footer keeps the card's own fill; only its top rule is coloured. Pitched
 * a couple of steps darker than the card's bottom colour, since that single
 * line is now the whole cue that the footer is a separate part.
 */
const FOOTER_RULE = {
  neutral: 'border-[#d3d8de]',
  pass: 'border-[#a3d5b8]',
  fail: 'border-[#e8b2ac]',
} as const;
const HEADER = 'px-6 pb-3 pt-6';
const FIELD_LABEL = 'truncate text-[11px] text-[#bfbfbf]';
const FIELD_BOX =
  'flex h-10 w-full items-center rounded-[12px] border border-[#e5e7eb] bg-[#f9fafb] px-3 ' +
  'text-sm font-medium text-slate-900';
const CELL_INPUT =
  'h-10 w-full rounded-[12px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium ' +
  'text-slate-900 outline-none transition focus:ring-2 focus:ring-[#5682e9]/30';
const RECORD_BOX = 'flex flex-col gap-3 rounded-[12px] bg-white p-4';
const STAT_CARD = 'flex flex-1 flex-col items-center gap-1.5 rounded-[16px] bg-white px-1 py-3';
const STAT_LABEL = 'text-center text-[10px] font-medium text-black/60';
const STAT_VALUE = 'text-base font-bold text-[#5682e9]';

// ── Props ──────────────────────────────────────────────────────────
/** Only the criteria fields the preview actually reads. */
export interface PreviewCriteria {
  code?: string;
  name?: string;
  unit?: string | null;
  sampleSize?: number | null;
  specTarget?: number | null;
  specTolerancePercent?: number | null;
  tolerancePercent?: number | null;
  dosageForm?: string | null;
  isCritical?: boolean;
  isActive?: boolean;
}

export interface IPCLivePreviewCardProps {
  formData: PreviewCriteria;
  criteriaType: CriteriaType;
  calculatedMinMax: { min: number; max: number } | null;
  acceptanceMath: { sampleSize: number; allowedFail: number; mustPass: number } | null;
  multiStageEnabled: boolean;
  stages: AcceptanceStage[];
  specPayload: SpecPayload | null;
  stage: StageValue;
  /**
   * Start every input empty. Set when the card is the recording surface rather
   * than a preview — the operator must enter what they measured, not confirm
   * numbers the screen invented.
   */
  blank?: boolean;
  /**
   * Called with what the operator has entered, whenever it changes. Set by a
   * screen that has to save the round; a preview leaves it off.
   */
  onValuesChange?: (values: RecordedValues) => void;
}

// ── Recording templates ────────────────────────────────────────────
type Template =
  | 'per_unit'
  | 'aggregate'
  | 'friability'
  | 'microbial'
  | 'pass_fail'
  | 'checklist'
  | 'text'
  | 'capsule_net'
  | 'tare_matched'
  | 'bulk_weigh'
  | 'tare_avg'
  | 'calibration'
  | 'calculated'
  | 'custom_fields';

/**
 * Which recording layout a criterion produces.
 *
 * Numeric splits four ways because the operator's job is genuinely different:
 * a friability test weighs one batch before and after, a microbial count is a
 * single plate read days later, a 20-tablet weight check is a grid, and a pH
 * reading is one number.
 */
function resolveTemplate(
  criteriaType: CriteriaType,
  formData: PreviewCriteria,
  specPayload: SpecPayload | null,
  sampleSize: number,
): Template {
  switch (criteriaType) {
    case 'numeric': {
      const name = formData.name ?? '';
      if (/friability|ความกร่อน/i.test(name)) return 'friability';
      if (/^cfu/i.test(formData.unit ?? '')) return 'microbial';
      return sampleSize > 1 ? 'per_unit' : 'aggregate';
    }
    case 'pass_fail':
      return 'pass_fail';
    case 'visual':
      return 'checklist';
    case 'text':
      return 'text';
    case 'multi_point': {
      if (specPayload?.type !== 'multi_point') return 'capsule_net';
      // Pooled tare: the shells are one figure instead of a table, while the
      // filled capsules stay a grid.
      if (specPayload.tareMode === 'bulk') return 'bulk_weigh';
      // With a tare criterion linked the shell weight arrives from there;
      // without one this criterion records both weighings itself.
      return specPayload.tareSourceCode ? 'tare_matched' : 'capsule_net';
    }
    case 'tare':
      return 'tare_avg';
    case 'calibration':
      return 'calibration';
    case 'calculated':
      return 'calculated';
    case 'custom_multi_field':
      return 'custom_fields';
    default:
      return 'aggregate';
  }
}

// ── Helpers ────────────────────────────────────────────────────────
const round = (n: number, d: number) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

const fmt = (n: number, d = 2) =>
  Number.isFinite(n) ? round(n, d).toLocaleString('en-US', { maximumFractionDigits: d }) : '—';

/**
 * Deterministic jitter in [0,1). `Math.random` would make the server render and
 * the first client render disagree, which React reports as a hydration error.
 */
function jitter(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * How many rows a count field asks for.
 *
 * `Number('0') || fallback` is 0-is-falsy, so a sample size of 0 used to fall
 * back to the default and the preview showed ten boxes for a criterion that
 * asks for none. An empty field still falls back — nothing has been said yet —
 * but a typed zero means zero.
 */
function rowCount(raw: string | undefined, fallback: number, max: number): number {
  const text = (raw ?? '').trim();
  const n = text === '' ? fallback : Number(text);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), max);
}

/** Shown in place of a table the spec has asked to be empty. */
function NoRows({ what }: { what: string }) {
  return (
    <p
      data-testid="preview-no-rows"
      className="rounded-[12px] border border-dashed border-[#e1e4e8] px-3 py-4 text-center text-[11px] text-[#bfbfbf]"
    >
      {what} = 0 — ยังไม่มีช่องให้บันทึก กำหนดจำนวนก่อน
    </p>
  );
}

function stats(values: number[]) {
  const n = values.length;
  if (n === 0) return { mean: 0, sd: 0, rsd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1
    ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
    : 0;
  return { mean, sd, rsd: mean === 0 ? 0 : (sd / mean) * 100 };
}

// ── Primitives ─────────────────────────────────────────────────────
/**
 * A spec value that may not fit its box, with the whole of it on hover.
 *
 * The tooltip is raised only when the text is actually clipped — offering one
 * on a value already fully readable is noise, and the reader learns to ignore
 * it on the rows where it matters. Width is measured rather than guessed from
 * character count, because the box narrows with the column layout.
 */
function TruncatedValue({ value }: { value: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = React.useState(false);
  const text = typeof value === 'string' ? value : null;

  const measure = React.useCallback(() => {
    const el = ref.current;
    // The 1px slack absorbs sub-pixel rounding, which otherwise reports a
    // perfectly fitting string as overflowing on fractional-scale displays.
    if (el) setClipped(el.scrollWidth > el.clientWidth + 1);
  }, []);

  React.useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, text]);

  if (!text || !clipped) {
    return (
      <span ref={ref} className="truncate">
        {value}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Focusable so the full text is reachable by keyboard too, not only
            by pointer. */}
        <span ref={ref} tabIndex={0} className="truncate outline-none">
          {value}
        </span>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="top"
          collisionPadding={12}
          // Above the record dialog (z-1200): the tooltip portals to the body
          // like the dialog does, so at the shared default it painted behind
          // the dialog and looked like nothing had happened on hover.
          className="z-[1300] max-w-[min(28rem,90vw)] whitespace-pre-wrap break-words text-[12px] leading-relaxed"
        >
          {text}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}

function SpecField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    // Labels wrap rather than truncate — "± % Tolerance" does not fit one line
    // in a three-column layout at 1440px, and a clipped label is unreadable.
    // The row is bottom-aligned so a two-line label still lines the boxes up.
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-[11px] leading-tight text-[#bfbfbf]">{label}</p>
      <div className={FIELD_BOX}>
        <TruncatedValue value={value} />
      </div>
    </div>
  );
}

/** Fill, border and text for a cell that has been judged against the spec. */
const CELL_STATE = {
  pass: 'border-[#a7e0bd] bg-[#e8f7ee] text-[#1a8a4a]',
  fail: 'border-[#f0b4ae] bg-[#fbeceb] text-[#c0362c]',
} as const;

function Cell({
  label,
  value,
  onChange,
  state,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  /** Colours the box once the value can be judged against the spec. */
  state?: 'pass' | 'fail' | null;
  readOnly?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className={FIELD_LABEL} title={label}>{label}</p>
      {readOnly ? (
        <div className={cn(FIELD_BOX, state && CELL_STATE[state])}>
          <span className="truncate">{value}</span>
        </div>
      ) : (
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(CELL_INPUT, state && CELL_STATE[state])}
          aria-label={label}
        />
      )}
    </div>
  );
}

/** Lays cells out three to a row, matching the Figma grid. */
function CellGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4">{children}</div>;
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'pass' | 'fail';
  /** The rule behind the number — e.g. the tolerance the allowance came from. */
  hint?: string;
}) {
  return (
    <div className={STAT_CARD}>
      <span className={STAT_LABEL}>{label}</span>
      <span
        className={cn(
          STAT_VALUE,
          tone === 'pass' && 'text-[#1a8a4a]',
          tone === 'fail' && 'text-[#c0362c]',
        )}
      >
        {value}
      </span>
      {hint && <span className="text-center text-[9px] leading-tight text-[#bfbfbf]">{hint}</span>}
    </div>
  );
}

function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-stretch gap-2">{children}</div>;
}

/**
 * Lets the recorder on screen tell the card whether the sample passed, so the
 * card surface can carry the verdict too. A context rather than prop drilling:
 * every recorder already renders a ResultBar, and there are nine of them.
 */
const VerdictContext = React.createContext<((pass: boolean | null) => void) | null>(null);

/**
 * The verdict gets its own full-width bar rather than a fifth stat card: the
 * Figma row fits four cards, and squeezing a fifth in wraps "fail / allowed"
 * onto two lines.
 */
function ResultBar({ pass, note }: { pass: boolean | null; note?: string }) {
  const report = React.useContext(VerdictContext);
  React.useEffect(() => report?.(pass), [pass, report]);
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-[16px] px-4 py-2.5',
        pass === null && 'bg-[#f9fafb]',
        pass === true && 'bg-[#e8f7ee]',
        pass === false && 'bg-[#fbeceb]',
      )}
    >
      <span className="text-[10px] font-medium text-black/60">{note ?? 'ผลการตรวจ'}</span>
      <span
        className={cn(
          'text-base font-bold tracking-wide',
          pass === null && 'text-[#bfbfbf]',
          pass === true && 'text-[#1a8a4a]',
          pass === false && 'text-[#c0362c]',
        )}
      >
        {pass === null ? '—' : pass ? 'PASS' : 'FAIL'}
      </span>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dashed border-[#e5e7eb] bg-[#f9fafb] px-4 py-6 text-center text-sm text-[#bfbfbf]">
      {children}
    </div>
  );
}


/**
 * Decorative GMP certification seal in the header. The Figma frame uses a
 * raster asset that is not in the repo, so this is a vector stand-in with the
 * same silhouette, fading into the card the way the design does.
 *
 * Sized for this column, which is roughly a third the width of the form —
 * a full-size seal here would sit on top of the spec fields rather than
 * behind them.
 */

// ── Card ───────────────────────────────────────────────────────────
export function IPCLivePreviewCard({
  formData,
  criteriaType,
  calculatedMinMax,
  acceptanceMath,
  multiStageEnabled,
  stages,
  specPayload,
  stage,
  blank = false,
  onValuesChange,
}: IPCLivePreviewCardProps) {
  const unit = formData.unit ?? '';


  const unitSuffix = unit ? ` (${unit})` : '';

  // Stage 1 is what the operator records first; later stages only start after
  // it fails, so previewing stage 1 is previewing the normal case.
  const sampleSize = multiStageEnabled && stages[0]
    ? (stages[0].sampleSize ?? formData.sampleSize ?? 1)
    : (acceptanceMath?.sampleSize ?? formData.sampleSize ?? 1);

  const template = resolveTemplate(criteriaType, formData, specPayload, sampleSize);

  // Templates without a verdict (tare reference, custom fields) never report,
  // so clear the tint on every template change rather than leaving the last
  // recorder's answer on screen.
  const [verdict, setVerdict] = React.useState<boolean | null>(null);
  const reportVerdict = React.useCallback((v: boolean | null) => setVerdict(v), []);
  React.useEffect(() => setVerdict(null), [template]);

  const bounds = calculatedMinMax
    ? { lo: calculatedMinMax.min, hi: calculatedMinMax.max }
    : null;

  const allowedFail = acceptanceMath?.allowedFail
    ?? Math.floor((sampleSize * (formData.tolerancePercent ?? 0)) / 100);

  const footerNote = React.useMemo(() => {
    const stageMeta = STAGE_OPTIONS.find((s) => s.value === stage);
    const count = testsForStage(stage).length;
    const form = DOSAGE_FORM_OPTIONS.find((d) => d.value === formData.dosageForm)?.label;
    const scope = form ? `${stageMeta?.titleEn} + ${form}` : stageMeta?.titleEn;
    return `กรองจาก ${count} หัวข้อที่ใช้กับ ${scope}`;
  }, [stage, formData.dosageForm]);

  return (
    // One provider for the whole card: the spec fields raise a tooltip when
    // their value is clipped, and Radix requires a provider above them.
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
    <div
      data-testid="live-preview-card"
      data-verdict={verdict === null ? 'none' : verdict ? 'pass' : 'fail'}
      className={cn(
        CARD,
        verdict === null && CARD_TINT.neutral,
        verdict === true && CARD_TINT.pass,
        verdict === false && CARD_TINT.fail,
      )}
    >
      {/* ── Header — spec summary ─────────────────────────────── */}
      {/* Washed in the selected stage's colour, like every other section
          header on the page, so the preview reads as part of that stage. */}
      <div className={cn(HEADER, 'relative overflow-hidden')}>
        <div className="relative z-10 flex flex-col gap-4">
          {(formData.code || formData.isCritical || formData.isActive === false) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {formData.code && (
                <span className="rounded-md bg-[#e8effc] px-2 py-0.5 font-mono text-[11px] font-bold text-[#3559b0]">
                  {formData.code}
                </span>
              )}
              {formData.isCritical && (
                <span className="rounded-md bg-[#fbeceb] px-2 py-0.5 text-[11px] font-bold text-[#c0362c]">
                  CRITICAL
                </span>
              )}
              {formData.isActive === false && (
                <span className="rounded-md bg-[#f1f3f5] px-2 py-0.5 text-[11px] font-medium text-[#6b7280]">
                  INACTIVE
                </span>
              )}
            </div>
          )}

          {/* Keeps the title clear of the seal — a heading running under the
              GMP mark reads as a rendering mistake, not as layering. */}
          <div className="flex flex-col gap-1 pr-[112px]">
            <p className="text-sm font-semibold text-black">เกณฑ์มาตรฐาน — Specification</p>
            <p className="truncate text-xs text-[#bfbfbf]" title={formData.name || undefined}>
              {formData.name || 'ยังไม่ได้เลือกหัวข้อทดสอบ'}
            </p>
          </div>

          <SpecHeaderFields
            template={template}
            formData={formData}
            specPayload={specPayload}
            calculatedMinMax={calculatedMinMax}
            unitSuffix={unitSuffix}
          />
        </div>
      </div>

      {/* ── Body — recording mock + stats ─────────────────────── */}
      {/* Horizontal padding stays at 24 so the recording boxes line up with the
          spec fields above; only the vertical rhythm is tightened. */}
      <div className="flex flex-col gap-3 px-6 pb-6 pt-3">
        {/* Keyed on the template so switching criteria type remounts the
            recorder — otherwise a verdict from the previous layout would keep
            tinting the card until something re-rendered. */}
        <VerdictContext.Provider value={reportVerdict}>
          <ReportContext.Provider value={onValuesChange ?? null}>
          <BlankContext.Provider value={blank}>
          <RecordingArea
            key={template}
            template={template}
            formData={formData}
            specPayload={specPayload}
            sampleSize={sampleSize}
            bounds={bounds}
            allowedFail={allowedFail}
            unit={unit}
          />
          </BlankContext.Provider>
          </ReportContext.Provider>
        </VerdictContext.Provider>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        data-testid="live-preview-footer"
        className={cn(
          'border-t px-6 py-4 transition-colors',
          verdict === null && FOOTER_RULE.neutral,
          verdict === true && FOOTER_RULE.pass,
          verdict === false && FOOTER_RULE.fail,
        )}
      >
        <p className="text-xs text-[#6b7280]">{footerNote}</p>
      </div>
    </div>
    </TooltipProvider>
  );
}

// ── Header fields ──────────────────────────────────────────────────
function SpecHeaderFields({
  template,
  formData,
  specPayload,
  calculatedMinMax,
  unitSuffix,
}: {
  template: Template;
  formData: PreviewCriteria;
  specPayload: SpecPayload | null;
  calculatedMinMax: { min: number; max: number } | null;
  unitSuffix: string;
}) {
  const dash = <span className="text-[#bfbfbf]">—</span>;
  const minMax = calculatedMinMax
    ? `${fmt(calculatedMinMax.min, 3)} – ${fmt(calculatedMinMax.max, 3)}`
    : null;

  const numericFields = (
    <>
      <SpecField label={`Target${unitSuffix}`} value={formData.specTarget ?? dash} />
      <SpecField label="± % Tolerance" value={formData.specTolerancePercent ?? dash} />
      <SpecField label="Min–Max (auto)" value={minMax ?? dash} />
    </>
  );

  let fields: React.ReactNode = numericFields;

  if (template === 'pass_fail' && specPayload?.type === 'pass_fail') {
    fields = (
      <>
        <SpecField label="PASS คือ" value={specPayload.passDefinition || dash} />
        <SpecField label="FAIL คือ" value={specPayload.failDefinition || dash} />
      </>
    );
  } else if (template === 'checklist' && specPayload?.type === 'visual') {
    fields = (
      <>
        <SpecField label="จุดตรวจ" value={specPayload.checklist.filter(Boolean).length || dash} />
        <SpecField label="รายละเอียด" value={specPayload.description || dash} />
      </>
    );
  } else if (template === 'text' && specPayload?.type === 'text') {
    fields = (
      <>
        <SpecField label="Format" value={specPayload.format || dash} />
        <SpecField label="ตัวอย่าง" value={specPayload.example || dash} />
      </>
    );
  } else if (
    // bulk_weigh belongs here too. It was left out, so a Multi-Point
    // criterion whose tare is weighed in bulk fell through to the numeric
    // header and reported Target/Tolerance from formData — fields this
    // criteria type never fills, so the author's own figures showed as "—".
    (template === 'capsule_net' || template === 'tare_matched' || template === 'bulk_weigh')
    && specPayload?.type === 'multi_point'
  ) {
    fields = (
      <>
        <SpecField
          label="จำนวนตัวอย่าง"
          value={specPayload.pointCount || dash}
        />
        <SpecField
          label={`Target ต่อหน่วย${unitSuffix}`}
          value={specPayload.perPointTarget || dash}
        />
        <SpecField label="± % Tolerance" value={specPayload.perPointTolerance || dash} />
      </>
    );
  } else if (template === 'tare_avg' && specPayload?.type === 'tare') {
    fields = (
      <>
        <SpecField label={`หน่วย`} value={specPayload.referenceUnit || dash} />
        <SpecField label="Min" value={specPayload.acceptanceMin || dash} />
        <SpecField label="Max" value={specPayload.acceptanceMax || dash} />
      </>
    );
  } else if (template === 'calibration' && specPayload?.type === 'calibration') {
    fields = (
      <>
        <SpecField
          label={`ค่ามาตรฐาน${specPayload.standardUnit ? ` (${specPayload.standardUnit})` : ''}`}
          value={specPayload.standardValue || dash}
        />
        <SpecField
          label={specPayload.toleranceType === 'percent' ? '± % Tolerance' : '± Tolerance'}
          value={specPayload.toleranceValue || dash}
        />
        <SpecField label="ครบกำหนด" value={specPayload.nextDueDate || dash} />
      </>
    );
  } else if (template === 'calculated' && specPayload?.type === 'calculated') {
    fields = (
      <>
        <SpecField label="สูตร" value={specPayload.formula || dash} />
        <SpecField label="หน่วยผลลัพธ์" value={specPayload.resultUnit || dash} />
        <SpecField
          label="Min–Max"
          value={
            specPayload.resultMin || specPayload.resultMax
              ? `${specPayload.resultMin || '—'} – ${specPayload.resultMax || '—'}`
              : dash
          }
        />
      </>
    );
  } else if (template === 'custom_fields' && specPayload?.type === 'custom_multi_field') {
    fields = (
      <>
        <SpecField label="จำนวนฟิลด์" value={specPayload.fields.length || dash} />
        <SpecField label="หมายเหตุ" value={specPayload.generalNote || dash} />
      </>
    );
  } else if (template === 'microbial') {
    fields = (
      <>
        <SpecField label={`Limit${unitSuffix}`} value={calculatedMinMax?.max ?? dash} />
        <SpecField label="Target" value={formData.specTarget ?? dash} />
        <SpecField label="± % Tolerance" value={formData.specTolerancePercent ?? dash} />
      </>
    );
  }

  return <div className="flex items-end gap-4">{fields}</div>;
}

// ── Recording area ─────────────────────────────────────────────────
interface RecordingProps {
  template: Template;
  formData: PreviewCriteria;
  specPayload: SpecPayload | null;
  sampleSize: number;
  bounds: { lo: number; hi: number } | null;
  allowedFail: number;
  unit: string;
}

function RecordingArea(props: RecordingProps) {
  switch (props.template) {
    case 'per_unit':
      return <PerUnitRecorder {...props} />;
    case 'capsule_net':
      return <CapsuleNetRecorder {...props} />;
    case 'tare_matched':
      return <TareMatchedRecorder {...props} />;
    case 'bulk_weigh':
      return <BulkWeighRecorder {...props} />;
    case 'tare_avg':
      return <TareAverageRecorder {...props} />;
    case 'friability':
      return <FriabilityRecorder {...props} />;
    case 'pass_fail':
      return <PassFailRecorder {...props} />;
    case 'checklist':
      return <ChecklistRecorder {...props} />;
    case 'text':
      return <TextRecorder {...props} />;
    case 'calibration':
      return <CalibrationRecorder {...props} />;
    case 'calculated':
      return <CalculatedRecorder {...props} />;
    case 'custom_fields':
      return <CustomFieldsRecorder {...props} />;
    case 'microbial':
    case 'aggregate':
    default:
      return <AggregateRecorder {...props} />;
  }
}

/**
 * Seeds demo values around the spec and keeps them editable, so the criteria
 * author can drag a number out of range and watch the accept/reject maths
 * react. Re-seeds whenever the spec that produced them changes.
 */
/**
 * True while the card is being used to record a real result.
 *
 * On the criteria screen the cells carry sample numbers so the author can see
 * the layout working. On the recording screen those same numbers would read as
 * measurements nobody took, so every cell starts empty instead.
 */
const BlankContext = React.createContext(false);

/**
 * What the operator has entered, in the one shape every recorder can express.
 *
 * The card draws thirteen different recording surfaces — a weight grid, a
 * verdict per sample, a checklist, a free-text answer — and the screen holding
 * the card has to save whatever came out of it. So each recorder reports the
 * same thing: readings in order, plus whether the round is complete. A screen
 * that only saves complete rounds can check one field rather than know which
 * of the thirteen it is looking at.
 */
export interface RecordedValues {
  samples: Array<{
    numericValue: number | null;
    result: 'pass' | 'fail' | null;
    textValue: string | null;
  }>;
  /** Set for free-text criteria, where there is one answer and no samples. */
  text?: string | null;
  /** Every reading the criterion asks for has been entered. */
  complete: boolean;
}

const ReportContext = React.createContext<((v: RecordedValues) => void) | null>(null);

/**
 * Hand the current entry up to whoever is holding the card.
 *
 * Serialised for the dependency check: the payload is rebuilt on every render,
 * so comparing the objects would report forever.
 */
function useReportValues(build: () => RecordedValues) {
  const report = React.useContext(ReportContext);
  const value = build();
  const key = JSON.stringify(value);
  React.useEffect(() => {
    report?.(JSON.parse(key) as RecordedValues);
  }, [key, report]);
}

/** Readings that came from a numeric grid. */
function numericSamples(
  values: string[],
  numbers: number[],
  verdict: (v: number, i: number) => 'pass' | 'fail' | null,
): RecordedValues {
  const samples = values.map((v, i) =>
    v.trim() === ''
      ? { numericValue: null, result: null, textValue: null }
      : { numericValue: numbers[i], result: verdict(numbers[i], i), textValue: null },
  );
  return { samples, complete: samples.length > 0 && samples.every((x) => x.numericValue != null) };
}

/** Readings that are a verdict per item rather than a measurement. */
function verdictSamples(verdicts: (boolean | null)[]): RecordedValues {
  const samples = verdicts.map((v) => ({
    numericValue: null,
    result: v === null ? null : v ? ('pass' as const) : ('fail' as const),
    textValue: null,
  }));
  return { samples, complete: samples.length > 0 && samples.every((x) => x.result != null) };
}

function useDemoValues(
  count: number,
  seed: (i: number) => number,
  signature: string,
  /**
   * False until the criterion carries enough spec to seed from. Inventing
   * numbers before that would read as real measurements — and the Figma frame
   * shows the cells empty — so the boxes stay blank instead.
   */
  seeded = true,
) {
  const blank = React.useContext(BlankContext);
  const fill = seeded && !blank;
  const build = React.useCallback(
    () => Array.from({ length: count }, (_, i) => (fill ? String(round(seed(i), 3)) : '')),
    // `seed` is rebuilt on every render by design; `signature` is the real key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, signature, fill],
  );
  const [values, setValues] = React.useState<string[]>(build);
  React.useEffect(() => setValues(build()), [build]);
  const set = (i: number, v: string) =>
    setValues((prev) => prev.map((old, idx) => (idx === i ? v : old)));
  const numbers = values.map((v) => (v.trim() === '' ? 0 : Number(v) || 0));
  /** Indexes the operator has actually filled — the only ones worth averaging. */
  const filled = numbers.filter((_, i) => values[i].trim() !== '');
  return { values, set, numbers, filled };
}

function judge(v: number, bounds: { lo: number; hi: number } | null): 'pass' | 'fail' | null {
  if (!bounds) return null;
  return v >= bounds.lo && v <= bounds.hi ? 'pass' : 'fail';
}

// Per-unit grid — n samples, mean/SD/%RSD and the accept/reject count.
function PerUnitRecorder({ sampleSize, bounds, allowedFail, formData }: RecordingProps) {
  const count = Math.min(Math.max(sampleSize, 0), 30);
  const base = bounds ? (bounds.lo + bounds.hi) / 2 : (formData.specTarget ?? 100);
  const spread = bounds ? (bounds.hi - bounds.lo) / 2 : base * 0.05;

  const { values, set, numbers, filled } = useDemoValues(
    count,
    // The last sample is seeded just outside the range so the fail/allowed
    // maths is visible instead of always reading 0.
    (i) => (i === count - 1 && bounds ? bounds.hi + spread * 0.4 : base + (jitter(i) - 0.5) * spread * 1.4),
    `${count}|${bounds?.lo}|${bounds?.hi}`,
    bounds != null,
  );

  useReportValues(() => numericSamples(values, numbers, (v) => judge(v, bounds)));

  const { mean, sd, rsd } = stats(filled);
  const failCount = bounds
    ? values.filter((v, i) => v.trim() !== '' && (numbers[i] < bounds.lo || numbers[i] > bounds.hi)).length
    : 0;
  const pass = failCount <= allowedFail;
  const has = filled.length > 0;

  return (
    <>
      <div className={RECORD_BOX}>
        {count === 0 && <NoRows what="Sample Size" />}
        <CellGrid>
          {values.map((v, i) => (
            <Cell
              key={i}
              label={`#${i + 1}`}
              value={v}
              onChange={(nv) => set(i, nv)}
              state={judge(numbers[i], bounds)}
            />
          ))}
        </CellGrid>
      </div>
      <StatRow>
        <StatCard label="x̄" value={has ? fmt(mean) : '—'} />
        <StatCard label="SD" value={has ? fmt(sd) : '—'} />
        <StatCard label="%RSD" value={has ? fmt(rsd, 1) : '—'} />
        <StatCard label="fail / allowed" value={`${failCount}/${allowedFail}`} />
      </StatRow>
      <ResultBar pass={bounds && has ? pass : null} />
    </>
  );
}

/**
 * Capsule weight variation, recorded end to end in this one criterion.
 *
 * Two tables, because that is two separate weighings on the bench: a set of
 * empty shells is weighed before filling to establish the tare, then the
 * filled capsules are weighed. They are different units in different counts —
 * putting both in one row would say the operator empties each capsule to weigh
 * its own shell, which is not the procedure.
 *
 * Net per capsule = its gross − the mean shell weight. The verdict is taken on
 * the net: judging the gross would let a heavy shell pass for a correct dose.
 */
function CapsuleNetRecorder({ sampleSize, allowedFail, formData, specPayload, unit }: RecordingProps) {
  const mp = specPayload?.type === 'multi_point' ? specPayload : null;
  const tareRows = rowCount(mp?.tareCount, 10, 20);
  const sampleRows = rowCount(mp?.pointCount, sampleSize, 20);
  const noun = (mp?.pointLabel || 'หน่วย').trim();
  // Whatever the criterion calls this weighing — a shell, a lid, a tray. The
  // recording screen has to say the same thing the criterion says.
  const tareTitle = (mp?.tareLabel || '').trim() || 'ชั่งแคปซูลเปล่า';
  const target = Number(mp?.perPointTarget ?? '') || formData.specTarget || 0;
  const shellBase = target > 0 ? target * 0.2 : 0;
  const seeded = target > 0;

  // Weight variation is judged on how far each unit sits from the sample mean,
  // not from the target — so no absolute min/max is needed here.
  const tol = Number(mp?.perPointTolerance ?? '') || formData.specTolerancePercent || 0;

  const shell = useDemoValues(
    tareRows,
    (i) => shellBase * (0.97 + jitter(i) * 0.06),
    `shell|${tareRows}|${target}`,
    seeded,
  );
  const gross = useDemoValues(
    sampleRows,
    (i) => shellBase + target * (0.96 + jitter(i + 90) * 0.08),
    `gross|${sampleRows}|${target}`,
    seeded,
  );

  const shellMean = shell.filled.length
    ? shell.filled.reduce((a, b) => a + b, 0) / shell.filled.length
    : 0;
  const tareReady = shell.filled.length > 0;

  const nets = gross.numbers.map((g) => g - shellMean);
  const done = (i: number) => tareReady && gross.values[i].trim() !== '';
  const filledNets = nets.filter((_, i) => done(i));
  const { mean, sd, rsd } = stats(filledNets);
  const has = filledNets.length > 0;

  /**
   * How far one unit sits from the target it was meant to hit, in percent.
   *
   *   (net − target) ÷ target × 100
   *
   * Measured against the Target the author entered, not against the mean of
   * the sample. The mean is what USP <905> Weight Variation compares to, and
   * it answers a different question — whether the units agree with each other.
   * An in-process weight check has to answer whether they agree with the dose,
   * and a batch that drifts off target together passes the mean test while
   * every unit is wrong.
   */
  const deviation = (i: number) =>
    target > 0 && done(i) ? ((nets[i] - target) / target) * 100 : null;

  const tolPct = tol > 0 ? tol : null;
  const outOfSpec = (i: number) => {
    const d = deviation(i);
    // The epsilon is not fussiness: (0.55 - 0.5) / 0.5 * 100 comes out as
    // 10.000000000000009 in binary floating point, so a unit sitting exactly
    // on +10% failed while the same unit at exactly -10% passed. A value on
    // the limit is inside it, on both sides.
    return tolPct != null && d != null && Math.abs(d) - tolPct > 1e-9;
  };
  const failCount = nets.filter((_, i) => done(i) && outOfSpec(i)).length;
  const pass = failCount <= allowedFail;

  // The gross weight belongs to the bench: judging it would let a heavy shell
  // pass for a correct dose, so the net is what leaves this card.
  useReportValues(() => ({
    samples: nets.map((n, i) =>
      done(i)
        ? {
            numericValue: round(n, 3),
            result: outOfSpec(i) ? ('fail' as const) : ('pass' as const),
            textValue: null,
          }
        : { numericValue: null, result: null, textValue: null },
    ),
    complete: tareReady && gross.values.every((v) => v.trim() !== ''),
  }));

  const u = unit ? ` (${unit})` : '';
  const step = (n: number, text: string) => (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5682e9] text-[10px] font-bold text-white">
        {n}
      </span>
      <span className="text-[11px] font-medium text-slate-700">{text}</span>
    </div>
  );

  return (
    <>
      {/* ── ตาราง Tare ─────────────────────────────────────── */}
      <div className={RECORD_BOX}>
        {step(1, `${tareTitle} — ${tareRows} ตัวอย่าง ก่อนบรรจุ`)}
        {tareRows === 0 && <NoRows what="จำนวนเปลือกที่ชั่ง (Tare)" />}
        <CellGrid>
          {shell.values.map((v, i) => (
            <Cell
              key={i}
              label={`เปล่า #${i + 1}`}
              value={v}
              onChange={(nv) => shell.set(i, nv)}
            />
          ))}
        </CellGrid>
        <div className="flex items-center justify-between rounded-[12px] bg-[#f9fafb] px-3 py-2">
          <span className="text-[11px] text-[#bfbfbf]">เฉลี่ยเปลือกเปล่า (Tare){u}</span>
          <span className="text-sm font-bold text-[#5682e9] tabular-nums">
            {tareReady ? fmt(shellMean, 4) : '—'}
          </span>
        </div>
      </div>

      {/* ── ตาราง Sample ───────────────────────────────────── */}
      <div className={RECORD_BOX}>
        {step(2, `ตารางการบันทึกผล — ${sampleRows} ตัวอย่าง · ระบบหัก Tare ให้เป็นน้ำหนักยา`)}
        {sampleRows === 0 && <NoRows what="จำนวนตัวอย่างที่วัด (Sample Size)" />}
        <div className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 px-1 text-[11px] leading-tight text-[#bfbfbf]">
          <span>#</span>
          <span>ยา + แคปซูล{u}</span>
          <span>น้ำหนักยาสุทธิ{u}</span>
          <span>% ส่วนต่างจาก Target</span>
        </div>
        {gross.values.map((g, i) => {
          const d = done(i) ? deviation(i) : null;
          const state = done(i) && tolPct != null ? (outOfSpec(i) ? 'fail' : 'pass') : null;
          return (
            <div key={i} className="grid grid-cols-[24px_1fr_1fr_1fr] items-center gap-2">
              <span className="text-[11px] text-[#bfbfbf]">{i + 1}</span>
              <input
                className={CELL_INPUT}
                value={g}
                onChange={(e) => gross.set(i, e.target.value)}
                aria-label={`ยาและแคปซูล #${i + 1}`}
              />
              <div className={FIELD_BOX}>{done(i) ? fmt(nets[i], 4) : '—'}</div>
              <div
                className={cn(FIELD_BOX, state && CELL_STATE[state])}
                data-testid={`deviation-${i}`}
              >
                {d == null ? '—' : `${d > 0 ? '+' : ''}${fmt(d, 2)}%`}
              </div>
            </div>
          );
        })}
      </div>

      <StatRow>
        <StatCard label="เฉลี่ยยาสุทธิ" value={has ? fmt(mean, 4) : '—'} />
        <StatCard label="SD" value={has ? fmt(sd, 4) : '—'} />
        <StatCard label="%RSD" value={has ? fmt(rsd, 1) : '—'} />
        <StatCard
          label="fail / allowed"
          value={`${failCount}/${allowedFail}`}
          tone={tolPct != null && has ? (pass ? 'pass' : 'fail') : undefined}
        />
      </StatRow>
      <ResultBar pass={tolPct != null && has ? pass : null} note="Weight Variation" />
      <p className="text-xs text-[#6b7280]">
        {target <= 0
          ? `กรอก Target ต่อ${noun} เพื่อให้ระบบคิดส่วนต่างได้`
          : tolPct == null
            ? `กรอก ±% Tolerance ต่อ${noun} เพื่อให้ระบบตัดสินผ่าน/ไม่ผ่านได้`
            : !has
              ? `แต่ละ${noun}ต้องต่างจาก Target ${fmt(target, 4)}${unit ? ` ${unit}` : ''} ไม่เกิน ±${fmt(tolPct, 1)}%`
              : `Target ${fmt(target, 4)}${unit ? ` ${unit}` : ''} — แต่ละ${noun}ต้องอยู่ใน ±${fmt(tolPct, 1)}% ของค่านี้ · หลุดเกณฑ์ ${failCount} จากที่ยอมได้ ${allowedFail} · ค่าเฉลี่ยที่ชั่งได้ ${fmt(mean, 4)}`}
      </p>
    </>
  );
}

// Matched-pair tare — gross and tare weighed for the same unit; net is derived.
function TareMatchedRecorder({ sampleSize, bounds, allowedFail, formData, specPayload }: RecordingProps) {
  const mp = specPayload?.type === 'multi_point' ? specPayload : null;
  const count = rowCount(mp?.pointCount, sampleSize, 20);
  const target = formData.specTarget ?? (bounds ? (bounds.lo + bounds.hi) / 2 : 100);
  // Only used to make the demo gross weights look like gross weights — a
  // rough shell allowance. It is never shown as a tare, and never typed into
  // the tare box, which the operator fills from the scale.
  const tareBase = target * 0.25;
  const sourceCode =
    specPayload?.type === 'multi_point' ? specPayload.tareSourceCode : '';
  const pointLabel =
    (specPayload?.type === 'multi_point' && specPayload.pointLabel) || 'หน่วย';

  const seeded = formData.specTarget != null || bounds != null;
  const gross = useDemoValues(
    count,
    (i) => target * (0.97 + jitter(i) * 0.06) + tareBase,
    `g|${count}|${target}`,
    seeded,
  );
  /**
   * Typed by the operator, and starts empty.
   *
   * It used to open on `target × 0.25`, a ratio invented here that read like a
   * measurement — and with no target set that came out as 25 from a fallback of
   * 100. A number nobody weighed has no business seeding a column of nets, so
   * the box stays blank until the shells are actually on the pan.
   */
  const [linkedTare, setLinkedTare] = React.useState('');
  const tareEntered = linkedTare.trim() !== '';
  const tareValue = tareEntered ? Number(linkedTare) || 0 : 0;

  const nets = gross.numbers.map((g) => g - tareValue);
  const done = (i: number) => tareEntered && gross.values[i].trim() !== '';
  const filledNets = nets.filter((_, i) => done(i));
  const { mean, sd, rsd } = stats(filledNets);
  const failCount = bounds
    ? gross.values.filter((_, i) => done(i) && (nets[i] < bounds.lo || nets[i] > bounds.hi)).length
    : 0;
  const pass = failCount <= allowedFail;
  const has = filledNets.length > 0;

  return (
    <>
      {/*
        Laid out in the order the work happens: the tare comes in from its own
        criterion first, then each point is weighed gross, then net falls out.
        Showing a blank tare column per point would say the operator has to
        weigh the shell again, which is the whole thing the link avoids.
      */}
      <div className={RECORD_BOX}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5682e9] text-[10px] font-bold text-white">
              1
            </span>
            <span className="text-[11px] font-medium text-slate-700">
              ค่า Tare จากเกณฑ์ที่ผูกไว้
            </span>
            {sourceCode && (
              <span className="rounded-md bg-[#e8effc] px-2 py-0.5 font-mono text-[10px] font-bold text-[#2f6fd0]">
                {sourceCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              className={cn(CELL_INPUT, 'w-28')}
              value={linkedTare}
              onChange={(e) => setLinkedTare(e.target.value)}
              placeholder="ชั่งแล้วกรอก"
              aria-label="ค่า Tare"
              data-testid="linked-tare-value"
            />
            <span className="text-[11px] text-[#bfbfbf]">
              {/* No unit chosen means none — printing g invented a unit the
                  author never picked, on the one figure the whole subtraction
                  depends on. */}
              {formData.unit ? `${formData.unit} · ` : ''}
              บันทึกครั้งเดียวต่อรุ่น ไม่ต้องชั่งซ้ำทุกหน่วย
            </span>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5682e9] text-[10px] font-bold text-white">
            2
          </span>
          <span className="text-[11px] font-medium text-slate-700">
            ตารางการบันทึกผล — ชั่งรวมของแต่ละ{pointLabel} · ระบบหัก Tare ให้เป็นน้ำหนักสุทธิ
          </span>
        </div>

        {count === 0 && <NoRows what="จำนวนตัวอย่างที่วัด (Sample Size)" />}
        <div className="grid grid-cols-[28px_1fr_1fr] gap-2 px-1 text-[11px] text-[#bfbfbf]">
          <span>#</span>
          <span className="truncate">Gross</span>
          <span className="truncate">Net (Gross − Tare)</span>
        </div>
        {gross.values.map((g, i) => {
          const state = done(i) ? judge(nets[i], bounds) : null;
          return (
            <div key={i} className="grid grid-cols-[28px_1fr_1fr] items-center gap-2">
              <span className="text-[11px] text-[#bfbfbf]">{i + 1}</span>
              <input
                className={CELL_INPUT}
                value={g}
                onChange={(e) => gross.set(i, e.target.value)}
                aria-label={`gross #${i + 1}`}
              />
              <div className={cn(FIELD_BOX, state && CELL_STATE[state])}>
                {done(i) ? fmt(nets[i], 3) : '—'}
              </div>
            </div>
          );
        })}
      </div>
      <StatRow>
        <StatCard label="net x̄" value={has ? fmt(mean, 3) : '—'} />
        <StatCard label="SD" value={has ? fmt(sd, 3) : '—'} />
        <StatCard label="%RSD" value={has ? fmt(rsd, 1) : '—'} />
        <StatCard label="fail / allowed" value={`${failCount}/${allowedFail}`} />
      </StatRow>
      <ResultBar pass={bounds && has ? pass : null} />
    </>
  );
}

/**
 * Pooled tare — Multi-Point with tareMode 'bulk'.
 *
 * Only the shells are pooled: N empty capsules go on the pan together, once,
 * because weighing them one by one before filling buys nothing — they are
 * interchangeable and none of them is traceable to a particular filled unit.
 *
 * The filled capsules are still weighed individually, so each one keeps its own
 * net (gross − mean shell) and its own verdict. That is the whole point of a
 * weight-variation check: an average hides the one capsule that came out light.
 */
function BulkWeighRecorder({ allowedFail, formData, specPayload, unit }: RecordingProps) {
  const mp = specPayload?.type === 'multi_point' ? specPayload : null;
  const tareBatch = rowCount(mp?.tareCount, 10, 999);
  const sampleRows = rowCount(mp?.pointCount, 10, 20);
  const noun = (mp?.pointLabel || 'หน่วย').trim();
  // Whatever the criterion calls this weighing — a shell, a lid, a tray. The
  // recording screen has to say the same thing the criterion says.
  const tareTitle = (mp?.tareLabel || '').trim() || 'ชั่งแคปซูลเปล่า';
  const target = Number(mp?.perPointTarget ?? '') || formData.specTarget || 0;
  const shellBase = target > 0 ? target * 0.2 : 0;
  const seeded = target > 0;

  const tol = Number(mp?.perPointTolerance ?? '') || formData.specTolerancePercent || 0;

  const shell = useDemoValues(1, () => shellBase * tareBatch, `bshell|${tareBatch}|${target}`, seeded);
  const gross = useDemoValues(
    sampleRows,
    (i) => shellBase + target * (0.96 + jitter(i + 90) * 0.08),
    `bgross|${sampleRows}|${target}`,
    seeded,
  );

  const tareReady = shell.values[0]?.trim() !== '';
  const shellMean = tareReady ? shell.numbers[0] / tareBatch : 0;

  const nets = gross.numbers.map((g) => g - shellMean);
  const done = (i: number) => tareReady && gross.values[i].trim() !== '';
  const filledNets = nets.filter((_, i) => done(i));
  const { mean, sd, rsd } = stats(filledNets);
  const has = filledNets.length > 0;

  /**
   * How far one unit sits from the target it was meant to hit, in percent.
   *
   *   (net − target) ÷ target × 100
   *
   * Measured against the Target the author entered, not against the mean of
   * the sample. The mean is what USP <905> Weight Variation compares to, and
   * it answers a different question — whether the units agree with each other.
   * An in-process weight check has to answer whether they agree with the dose,
   * and a batch that drifts off target together passes the mean test while
   * every unit is wrong.
   */
  const deviation = (i: number) =>
    target > 0 && done(i) ? ((nets[i] - target) / target) * 100 : null;

  const tolPct = tol > 0 ? tol : null;
  const outOfSpec = (i: number) => {
    const d = deviation(i);
    // The epsilon is not fussiness: (0.55 - 0.5) / 0.5 * 100 comes out as
    // 10.000000000000009 in binary floating point, so a unit sitting exactly
    // on +10% failed while the same unit at exactly -10% passed. A value on
    // the limit is inside it, on both sides.
    return tolPct != null && d != null && Math.abs(d) - tolPct > 1e-9;
  };
  const failCount = nets.filter((_, i) => done(i) && outOfSpec(i)).length;
  const pass = failCount <= allowedFail;

  // The gross weight belongs to the bench: judging it would let a heavy shell
  // pass for a correct dose, so the net is what leaves this card.
  useReportValues(() => ({
    samples: nets.map((n, i) =>
      done(i)
        ? {
            numericValue: round(n, 3),
            result: outOfSpec(i) ? ('fail' as const) : ('pass' as const),
            textValue: null,
          }
        : { numericValue: null, result: null, textValue: null },
    ),
    complete: tareReady && gross.values.every((v) => v.trim() !== ''),
  }));

  const u = unit ? ` (${unit})` : '';
  const step = (n: number, text: string) => (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5682e9] text-[10px] font-bold text-white">
        {n}
      </span>
      <span className="text-[11px] font-medium text-slate-700">{text}</span>
    </div>
  );

  return (
    <>
      {/* ── ① Tare รวม — ชั่งครั้งเดียว ─────────────────────── */}
      <div className={RECORD_BOX}>
        {step(1, `${tareTitle} — ${tareBatch} ตัวอย่าง พร้อมกัน ก่อนบรรจุ`)}
        {tareBatch === 0 && <NoRows what="จำนวนเปลือกที่ชั่ง (Tare)" />}
        <Cell
          label={`น้ำหนักรวมแคปซูลเปล่า${u}`}
          value={shell.values[0] ?? ''}
          onChange={(v) => shell.set(0, v)}
        />
        <div className="flex items-center justify-between rounded-[12px] bg-[#f9fafb] px-3 py-2">
          <span className="text-[11px] text-[#bfbfbf]">
            เฉลี่ยเปลือกเปล่า (Tare){u} — หารด้วย {tareBatch}
          </span>
          <span className="text-sm font-bold text-[#5682e9] tabular-nums">
            {tareReady ? fmt(shellMean, 4) : '—'}
          </span>
        </div>
      </div>

      {/* ── ② ตาราง Sample — เหมือนโหมดชั่งทีละเม็ดทุกประการ ── */}
      <div className={RECORD_BOX}>
        {step(2, `ตารางการบันทึกผล — ${sampleRows} ตัวอย่าง · ระบบหัก Tare ให้เป็นน้ำหนักยา`)}
        {sampleRows === 0 && <NoRows what="จำนวนตัวอย่างที่วัด (Sample Size)" />}
        <div className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 px-1 text-[11px] leading-tight text-[#bfbfbf]">
          <span>#</span>
          <span>ยา + แคปซูล{u}</span>
          <span>น้ำหนักยาสุทธิ{u}</span>
          <span>% ส่วนต่างจาก Target</span>
        </div>
        {gross.values.map((g, i) => {
          const d = done(i) ? deviation(i) : null;
          const state = done(i) && tolPct != null ? (outOfSpec(i) ? 'fail' : 'pass') : null;
          return (
            <div key={i} className="grid grid-cols-[24px_1fr_1fr_1fr] items-center gap-2">
              <span className="text-[11px] text-[#bfbfbf]">{i + 1}</span>
              <input
                className={CELL_INPUT}
                value={g}
                onChange={(e) => gross.set(i, e.target.value)}
                aria-label={`ยาและแคปซูล #${i + 1}`}
              />
              <div className={FIELD_BOX}>{done(i) ? fmt(nets[i], 4) : '—'}</div>
              <div
                className={cn(FIELD_BOX, state && CELL_STATE[state])}
                data-testid={`deviation-${i}`}
              >
                {d == null ? '—' : `${d > 0 ? '+' : ''}${fmt(d, 2)}%`}
              </div>
            </div>
          );
        })}
      </div>

      <StatRow>
        <StatCard label="เฉลี่ยยาสุทธิ" value={has ? fmt(mean, 4) : '—'} />
        <StatCard label="SD" value={has ? fmt(sd, 4) : '—'} />
        <StatCard label="%RSD" value={has ? fmt(rsd, 1) : '—'} />
        <StatCard
          label="fail / allowed"
          value={`${failCount}/${allowedFail}`}
          tone={tolPct != null && has ? (pass ? 'pass' : 'fail') : undefined}
        />
      </StatRow>
      <ResultBar pass={tolPct != null && has ? pass : null} note="Weight Variation" />
      <p className="text-xs text-[#6b7280]">
        {target <= 0
          ? `กรอก Target ต่อ${noun} เพื่อให้ระบบคิดส่วนต่างได้`
          : tolPct == null
            ? `กรอก ±% Tolerance ต่อ${noun} เพื่อให้ระบบตัดสินผ่าน/ไม่ผ่านได้`
            : `Tare ชั่งรวมครั้งเดียวแล้วเฉลี่ย — ส่วนแต่ละ${noun}ยังตัดสินรายตัวใน ±${fmt(tolPct, 1)}% ของ Target ${fmt(target, 4)}${unit ? ` ${unit}` : ''}`}
      </p>
    </>
  );
}

// Average tare — empty containers weighed once, then every filled unit has the
// mean shell weight subtracted. Used when the shells are interchangeable.
function TareAverageRecorder({ specPayload, sampleSize, unit }: RecordingProps) {
  const tare = specPayload?.type === 'tare' ? specPayload : null;
  const lo = tare?.acceptanceMin ? Number(tare.acceptanceMin) : null;
  const hi = tare?.acceptanceMax ? Number(tare.acceptanceMax) : null;
  const bounds = lo != null && hi != null && Number.isFinite(lo) && Number.isFinite(hi)
    ? { lo, hi }
    : null;
  const base = bounds ? (bounds.lo + bounds.hi) / 2 : 0.1;
  const count = Math.min(Math.max(sampleSize, 1), 20);

  const shells = useDemoValues(
    count,
    (i) => base * (0.97 + jitter(i) * 0.06),
    `shell|${count}|${base}`,
  );
  const { mean, sd, rsd } = stats(shells.numbers);
  const failCount = bounds ? shells.numbers.filter((v) => v < bounds.lo || v > bounds.hi).length : 0;

  return (
    <>
      <div className={RECORD_BOX}>
        <p className="px-1 text-xs text-[#6b7280]">
          {tare?.referenceLabel || 'น้ำหนักภาชนะเปล่า'}
          {tare?.referenceUnit ? ` (${tare.referenceUnit})` : unit ? ` (${unit})` : ''}
        </p>
        <CellGrid>
          {shells.values.map((v, i) => (
            <Cell
              key={i}
              label={`#${i + 1}`}
              value={v}
              onChange={(nv) => shells.set(i, nv)}
              state={judge(shells.numbers[i], bounds)}
            />
          ))}
        </CellGrid>
      </div>
      <StatRow>
        <StatCard label="tare x̄" value={fmt(mean, 3)} />
        <StatCard label="SD" value={fmt(sd, 3)} />
        <StatCard label="%RSD" value={fmt(rsd, 1)} />
        <StatCard label="นอกช่วง" value={String(failCount)} />
      </StatRow>
      <p className="text-xs text-[#6b7280]">
        ค่าเฉลี่ยนี้จะถูกหักออกจากน้ำหนักรวมของทุกชิ้นที่ผูกกับเกณฑ์นี้
        {tare?.expireAfter === 'shift' && ' · ใช้ได้ภายในกะเดียว'}
        {tare?.expireAfter === 'batch' && ' · ใช้ได้ภายในรุ่นผลิตเดียว'}
      </p>
    </>
  );
}

// Friability — one weighing before tumbling, one after; the loss is the result.
function FriabilityRecorder({ bounds }: RecordingProps) {
  const [before, setBefore] = React.useState('6.500');
  const [after, setAfter] = React.useState('6.445');
  const b = Number(before) || 0;
  const a = Number(after) || 0;
  const loss = b > 0 ? ((b - a) / b) * 100 : 0;
  const limit = bounds?.hi ?? 1;
  const pass = loss <= limit;

  return (
    <>
      <div className={RECORD_BOX}>
        <div className="grid grid-cols-2 gap-4">
          <Cell label="น้ำหนักก่อน (g)" value={before} onChange={setBefore} />
          <Cell label="น้ำหนักหลัง (g)" value={after} onChange={setAfter} />
        </div>
      </div>
      <StatRow>
        <StatCard label="% weight loss" value={`${fmt(loss)}%`} />
        <StatCard label="Limit" value={`≤ ${fmt(limit)}%`} />
      </StatRow>
      <ResultBar pass={pass} />
    </>
  );
}

// One number for the whole batch — pH, viscosity, assay, microbial count.
function AggregateRecorder({ bounds, unit, formData, template }: RecordingProps) {
  const seed = bounds ? (bounds.lo + bounds.hi) / 2 : (formData.specTarget ?? 0);
  const { values, set, numbers } = useDemoValues(1, () => seed, `agg|${seed}`, bounds != null);
  const has = values[0]?.trim() !== '';
  const state = has ? judge(numbers[0], bounds) : null;

  useReportValues(() => numericSamples(values, numbers, (v) => judge(v, bounds)));

  return (
    <>
      <div className={RECORD_BOX}>
        <Cell
          label={template === 'microbial' ? `จำนวนนับ${unit ? ` (${unit})` : ''}` : `ค่าที่วัดได้${unit ? ` (${unit})` : ''}`}
          value={values[0]}
          onChange={(v) => set(0, v)}
          state={state}
        />
      </div>
      <StatRow>
        <StatCard label="ค่าที่วัดได้" value={has ? fmt(numbers[0], 3) : '—'} />
        <StatCard
          label="ช่วงที่ยอมรับ"
          value={bounds ? `${fmt(bounds.lo, 3)} – ${fmt(bounds.hi, 3)}` : '—'}
        />
      </StatRow>
      <ResultBar pass={state === null ? null : state === 'pass'} />
      {template === 'microbial' && (
        <p className="text-xs text-[#6b7280]">
          ผลเพาะเชื้อใช้เวลา 3–5 วัน จึงบันทึกย้อนหลัง ไม่ใช่ตามรอบ Check Interval
        </p>
      )}
    </>
  );
}

// Checklist / pass-fail — a tick per inspection point or per sampled unit.
/**
 * Pass / Fail — judged against the two definitions the criterion carries.
 *
 * This used to borrow the visual checklist, which showed a column of ticked
 * boxes labelled "ตัวอย่าง #1…" and nothing else. It never said what passing
 * meant, and every box arrived already ticked, so the screen answered the
 * question before the operator had looked at anything.
 *
 * The definitions come first, because they are what the operator compares
 * against; the verdict is then two explicit buttons per sample, neither of
 * them preselected.
 */
function PassFailRecorder({ formData, specPayload, sampleSize, allowedFail }: RecordingProps) {
  const pf = specPayload?.type === 'pass_fail' ? specPayload : null;
  const count = Math.min(Math.max(sampleSize, 1), 20);
  const [verdicts, setVerdicts] = React.useState<(boolean | null)[]>(() =>
    Array.from({ length: count }, () => null),
  );
  React.useEffect(
    () => setVerdicts(Array.from({ length: count }, () => null)),
    [count],
  );

  const judged = verdicts.filter((v) => v !== null).length;
  const failCount = verdicts.filter((v) => v === false).length;
  const passCount = verdicts.filter((v) => v === true).length;
  const done = judged === count;
  const pass = failCount <= allowedFail;

  const set = (i: number, v: boolean) =>
    setVerdicts((prev) => prev.map((old, idx) => (idx === i ? (old === v ? null : v) : old)));

  const Definition = ({
    tone,
    title,
    text,
  }: {
    tone: 'pass' | 'fail';
    title: string;
    text: string;
  }) => (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1.5 rounded-[12px] border p-3',
        tone === 'pass' ? 'border-[#a7e0bd] bg-[#e8f7ee]' : 'border-[#f0b4ae] bg-[#fbeceb]',
      )}
    >
      <span
        className={cn(
          'text-[11px] font-bold',
          tone === 'pass' ? 'text-[#1a8a4a]' : 'text-[#c0362c]',
        )}
      >
        {title}
      </span>
      <span className={cn('text-xs leading-relaxed', text ? 'text-slate-700' : 'text-[#bfbfbf]')}>
        {text || 'ยังไม่ได้กำหนดในเกณฑ์'}
      </span>
    </div>
  );

  useReportValues(() => verdictSamples(verdicts));

  return (
    <>
      {/* What the operator is judging against. */}
      <div className={RECORD_BOX} data-testid="pass-fail-definitions">
        <p className="text-[11px] font-medium text-slate-700">เทียบกับเกณฑ์นี้</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Definition tone="pass" title="ผ่าน (PASS)" text={pf?.passDefinition ?? ''} />
          <Definition tone="fail" title="ไม่ผ่าน (FAIL)" text={pf?.failDefinition ?? ''} />
        </div>
      </div>

      {/* The verdict itself. */}
      <div className={RECORD_BOX}>
        <p className="text-[11px] font-medium text-slate-700">
          ตัดสินทีละตัวอย่าง — {count} ตัวอย่าง
        </p>
        {verdicts.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-[#bfbfbf]">ตัวอย่าง {i + 1}</span>
            {([true, false] as const).map((want) => {
              const on = v === want;
              return (
                <button
                  type="button"
                  key={String(want)}
                  aria-pressed={on}
                  aria-label={`ตัวอย่าง ${i + 1} ${want ? 'ผ่าน' : 'ไม่ผ่าน'}`}
                  data-testid={`pf-${i}-${want ? 'pass' : 'fail'}`}
                  onClick={() => set(i, want)}
                  className={cn(
                    'h-9 flex-1 rounded-[10px] border text-xs font-semibold transition-colors',
                    on && want && 'border-[#1a8a4a] bg-[#1a8a4a] text-white',
                    on && !want && 'border-[#c0362c] bg-[#c0362c] text-white',
                    !on && 'border-[#e5e7eb] bg-[#f9fafb] text-slate-500 hover:border-[#9db9e8]',
                  )}
                >
                  {want ? 'PASS' : 'FAIL'}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <StatRow>
        <StatCard label="ผ่าน" value={String(passCount)} />
        <StatCard label="ไม่ผ่าน" value={String(failCount)} />
        <StatCard
          label="เสียได้"
          value={String(allowedFail)}
          hint={`ยอมรับ ${formatNumber(formData.tolerancePercent ?? 0)}%`}
        />
        <StatCard label="ยังไม่ตัดสิน" value={String(count - judged)} />
      </StatRow>
      {/* No verdict until every sample has one — a batch cannot be passed on
          the strength of the samples nobody looked at. */}
      <ResultBar pass={done ? pass : null} note={done ? undefined : 'ตัดสินให้ครบทุกตัวอย่างก่อน'} />
    </>
  );
}

function ChecklistRecorder({ template, formData, specPayload, sampleSize, allowedFail }: RecordingProps) {
  const blank = React.useContext(BlankContext);
  const items = React.useMemo(() => {
    if (template === 'checklist' && specPayload?.type === 'visual') {
      const list = specPayload.checklist.filter(Boolean);
      if (list.length > 0) return list.slice(0, 12);
    }
    return Array.from({ length: Math.min(Math.max(sampleSize, 1), 12) }, (_, i) => `ตัวอย่าง #${i + 1}`);
  }, [template, specPayload, sampleSize]);

  // Undecided while recording — a tick box that starts ticked passes every
  // item the operator never looked at. The verdict has to be given, not
  // withheld, so each row is an explicit PASS/FAIL choice like every other
  // per-sample judgement on this card.
  const [verdicts, setVerdicts] = React.useState<(boolean | null)[]>(() =>
    items.map(() => (blank ? null : true)),
  );
  React.useEffect(() => setVerdicts(items.map(() => (blank ? null : true))), [items, blank]);
  const set = (i: number, want: boolean) =>
    setVerdicts((prev) => prev.map((v, idx) => (idx === i ? (v === want ? null : want) : v)));

  useReportValues(() => verdictSamples(verdicts));

  const judged = verdicts.filter((v) => v !== null).length;
  const passCount = verdicts.filter((v) => v === true).length;
  const failCount = verdicts.filter((v) => v === false).length;
  const limit = template === 'checklist' ? 0 : allowedFail;
  const done = judged === verdicts.length;
  const pass = failCount <= limit;

  return (
    <>
      <div className={RECORD_BOX}>
        {items.map((label, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-[12px] bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="min-w-0 flex-1 text-sm text-slate-900">{label}</span>
            <div className="flex shrink-0 gap-2 sm:w-[184px]">
              {([true, false] as const).map((want) => {
                const on = verdicts[i] === want;
                return (
                  <button
                    type="button"
                    key={String(want)}
                    aria-pressed={on}
                    aria-label={`${label} ${want ? 'ผ่าน' : 'ไม่ผ่าน'}`}
                    data-testid={`cl-${i}-${want ? 'pass' : 'fail'}`}
                    onClick={() => set(i, want)}
                    className={cn(
                      'h-9 flex-1 rounded-[10px] border text-xs font-semibold transition-colors',
                      on && want && 'border-[#1a8a4a] bg-[#1a8a4a] text-white',
                      on && !want && 'border-[#c0362c] bg-[#c0362c] text-white',
                      !on && 'border-[#e5e7eb] bg-[#f9fafb] text-slate-500 hover:border-[#9db9e8]',
                    )}
                  >
                    {want ? 'PASS' : 'FAIL'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <StatRow>
        <StatCard label="ผ่าน" value={String(passCount)} />
        <StatCard label="ไม่ผ่าน" value={String(failCount)} />
        <StatCard
          label="เสียได้"
          value={String(limit)}
          hint={
            template === 'checklist'
              ? 'ต้องผ่านทุกข้อ'
              : `ยอมรับ ${formatNumber(formData.tolerancePercent ?? 0)}%`
          }
        />
        <StatCard label="ยังไม่ตัดสิน" value={String(verdicts.length - judged)} />
      </StatRow>
      <ResultBar pass={done ? pass : null} note={done ? undefined : 'ตัดสินให้ครบทุกหัวข้อก่อน'} />
    </>
  );
}

// Free-text result — the operator types what they observed.
function TextRecorder({ specPayload }: RecordingProps) {
  const text = specPayload?.type === 'text' ? specPayload : null;
  const [value, setValue] = React.useState('');

  useReportValues(() => ({
    samples: [{ numericValue: null, result: null, textValue: value.trim() || null }],
    text: value.trim() || null,
    complete: value.trim() !== '',
  }));

  return (
    <>
      <div className={RECORD_BOX}>
        <div className="flex flex-col gap-2">
          <p className={FIELD_LABEL}>ผลตรวจ (ข้อความ){text?.required ? ' *' : ''}</p>
          <textarea
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={text?.example ? `เช่น ${text.example}` : 'พิมพ์ผลที่บันทึก'}
            className="w-full resize-none rounded-[16px] bg-white p-3 text-sm text-slate-900 outline-none placeholder:text-[#bfbfbf] focus:ring-2 focus:ring-[#5682e9]/30"
            aria-label="ผลตรวจ"
          />
        </div>
      </div>
      <StatRow>
        <StatCard label="ความยาว" value={String(value.length)} />
        <StatCard label="Format" value={text?.format || '—'} />
      </StatRow>
      <ResultBar
        pass={!(text?.required && value.trim() === '')}
        note={text?.required ? 'ต้องกรอกก่อนบันทึก' : 'ผลการตรวจ'}
      />
    </>
  );
}

// Calibration — one reading of a certified standard before real measuring.
function CalibrationRecorder({ specPayload }: RecordingProps) {
  const cal = specPayload?.type === 'calibration' ? specPayload : null;
  const standard = Number(cal?.standardValue ?? '') || 0;
  const tolValue = Number(cal?.toleranceValue ?? '') || 0;
  const allowance = cal?.toleranceType === 'percent' ? (standard * tolValue) / 100 : tolValue;
  const blank = React.useContext(BlankContext);
  const [reading, setReading] = React.useState(blank ? '' : String(round(standard, 3)));

  React.useEffect(() => setReading(String(round(standard, 3))), [standard]);

  const r = Number(reading) || 0;
  const deviation = r - standard;
  const pass = Math.abs(deviation) <= allowance;

  if (!cal) return <EmptyNote>ยังไม่ได้ตั้งค่าเครื่องมือและค่ามาตรฐาน</EmptyNote>;

  return (
    <>
      <div className={RECORD_BOX}>
        <p className="px-1 text-xs text-[#6b7280]">
          {cal.instrumentName || 'เครื่องมือ'}
          {cal.instrumentId ? ` · ${cal.instrumentId}` : ''}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Cell
            label={`ค่ามาตรฐาน${cal.standardUnit ? ` (${cal.standardUnit})` : ''}`}
            value={cal.standardValue || '—'}
            readOnly
          />
          <Cell
            label="ค่าที่อ่านได้"
            value={reading}
            onChange={setReading}
            state={pass ? 'pass' : 'fail'}
          />
        </div>
      </div>
      <StatRow>
        <StatCard label="ผลต่าง" value={fmt(deviation, 3)} />
        <StatCard label="ยอมรับได้" value={`± ${fmt(allowance, 3)}`} />
      </StatRow>
      <ResultBar pass={pass} />
      {cal.requiresPriorPass && (
        <p className="text-xs text-[#6b7280]">ต้องผ่านข้อนี้ก่อน จึงจะบันทึกผลทดสอบอื่นได้</p>
      )}
    </>
  );
}

// Calculated — the operator supplies the inputs, the formula gives the result.
function CalculatedRecorder({ specPayload }: RecordingProps) {
  const calc = specPayload?.type === 'calculated' ? specPayload : null;
  const inputs = calc?.inputs ?? [];
  const decimals = Number(calc?.displayDecimals ?? '2') || 2;

  const { values, set, numbers } = useDemoValues(
    inputs.length,
    (i) => (inputs[i]?.source === 'constant' ? Number(inputs[i]?.constantValue) || 0 : 100 * (0.95 + jitter(i) * 0.1)),
    `calc|${inputs.map((i) => i.id).join(',')}`,
  );

  if (!calc || inputs.length === 0) {
    return <EmptyNote>ยังไม่ได้กำหนดตัวแปรของสูตรคำนวณ</EmptyNote>;
  }

  // Purely illustrative: the real evaluation happens in the recording service.
  // The preview shows the mean of the inputs so the layout is not empty.
  const result = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  const lo = calc.resultMin === '' ? null : Number(calc.resultMin);
  const hi = calc.resultMax === '' ? null : Number(calc.resultMax);
  const bounds = lo != null && hi != null && Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : null;
  const state = judge(result, bounds);

  return (
    <>
      <div className={RECORD_BOX}>
        <p className="px-1 font-mono text-xs text-[#6b7280]">{calc.formula || '—'}</p>
        <CellGrid>
          {inputs.map((input, i) => (
            <Cell
              key={input.id}
              label={input.name || `ตัวแปร ${i + 1}`}
              value={values[i] ?? ''}
              onChange={(v) => set(i, v)}
              readOnly={input.source === 'constant'}
            />
          ))}
        </CellGrid>
      </div>
      <StatRow>
        <StatCard
          label={`ผลลัพธ์${calc.resultUnit ? ` (${calc.resultUnit})` : ''}`}
          value={fmt(result, decimals)}
        />
        <StatCard label="ช่วงที่ยอมรับ" value={bounds ? `${fmt(bounds.lo)} – ${fmt(bounds.hi)}` : '—'} />
      </StatRow>
      <ResultBar pass={state === null ? null : state === 'pass'} />
      <p className="text-xs text-[#6b7280]">
        ตัวอย่างนี้แสดงเลย์เอาต์ของช่องกรอก ผลจริงคำนวณจากสูตรตอนบันทึก
      </p>
    </>
  );
}

// Custom multi-field — an arbitrary set of typed fields in one record.
function CustomFieldsRecorder({ specPayload }: RecordingProps) {
  const custom = specPayload?.type === 'custom_multi_field' ? specPayload : null;
  const fields = custom?.fields ?? [];

  if (fields.length === 0) return <EmptyNote>ยังไม่ได้เพิ่มฟิลด์</EmptyNote>;

  return (
    <>
      <div className={RECORD_BOX}>
        <CellGrid>
          {fields.slice(0, 12).map((f) => (
            <Cell
              key={f.id}
              label={`${f.label || 'ฟิลด์'}${f.unit ? ` (${f.unit})` : ''}${f.required ? ' *' : ''}`}
              value={f.target || ''}
              readOnly
            />
          ))}
        </CellGrid>
      </div>
      <StatRow>
        <StatCard label="ฟิลด์ทั้งหมด" value={String(fields.length)} />
        <StatCard label="บังคับกรอก" value={String(fields.filter((f) => f.required).length)} />
        <StatCard label="ตัวเลข" value={String(fields.filter((f) => f.fieldType === 'number').length)} />
        <StatCard label="ตัวเลือก" value={String(fields.filter((f) => f.fieldType === 'select').length)} />
      </StatRow>
      {custom?.generalNote && <p className="text-xs text-[#6b7280]">{custom.generalNote}</p>}
    </>
  );
}

export default IPCLivePreviewCard;
