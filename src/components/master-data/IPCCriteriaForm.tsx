'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ResponsivePageHeader } from '@/components/shared';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SearchableSelect, type SearchableSelectOption } from '@/components/master-data/SearchableSelect';
import { IPCLivePreviewCard } from '@/components/master-data/IPCLivePreviewCard';
import { STAGE_THEME, type StageTheme } from '@/components/master-data/ipc-stage-theme';
import { GmpDocumentSelect } from '@/components/documents';
import { FlaskConical, Shield, Eye, FileText, Layers, Plus, User, ClockAlert, ScanFace, Info, CircleAlert, Power, Trash2, ArrowDown, TriangleAlert, Sparkles, Clock, Package, Target, Zap, RotateCcw, Calculator, X, ChevronDown, Lock, Check } from 'lucide-react';
import { calculateMinMax, validateSpecInputs } from '@/lib/utils/ipc-criteria-calc';
import { cn } from '@/lib/utils/cn';
import {
  IPC_TEST_CATALOG,
  testsForStage,
  dosageFormOptionsForStage,
  unitOptionsForDosageForm,
  unitOptionsForTest,
  testKeyFromName,
  adaptUnitToDosageForm,
  SAMPLING_METHOD_OPTIONS,
  cadenceForSamplingMethod,
  type SamplingCadence,
  normalizeCriteriaType,
  findTestByName,
  suggestCodeForTest,
  suggestCodeForCustom,
  type CriteriaType,
} from '@/lib/master-data/ipc-test-catalog';
import {
  parseAcceptanceStages,
  calcStageAcceptance,
  totalStageSamples,
  emptyStage,
  USP_DISSOLUTION_PLAN,
  USP_UNIFORMITY_PLAN,
  type AcceptanceStage,
} from '@/lib/master-data/ipc-stages';
import {
  parseSpecPayload,
  defaultPayload,
  parseSharedExtras,
  defaultSharedExtras,
  serializeSpecification,
  STAGE_OPTIONS,
  type StageValue,
  type SpecPayload,
  type PassFailPayload,
  type VisualPayload,
  type TextPayload,
  type MultiPointPayload,
  type TarePayload,
  type CalibrationPayload,
  type CalculatedPayload,
  type CalculatedInput,
  type CustomMultiFieldPayload,
  type CustomField,
  type SharedSpecExtras,
  type SopStepRef,
  type Triggers,
  type DerivedCalc,
  USE_CONTEXT_OPTIONS,
  contextOptionsForStage,
  triggersForContexts,
  type TriggerKey,
} from '@/lib/master-data/ipc-spec-payload';

// ────────────────────────────────────────────────────────────────────
// Style constants — mirror the prototype's CSS classes via Tailwind
// so the form looks identical to https://oommiemie.github.io/ipc-criteria-prototype/.
// ────────────────────────────────────────────────────────────────────
/**
 * The criteria types this form can build, in the order the picker lists them.
 *
 * Narrower than the CriteriaType union on purpose: `text` and `calibration`
 * exist in recorded data but are not offered here, and listing them would put
 * two unbuildable choices in front of the author.
 */
const CRITERIA_TYPE_VALUES = [
  'numeric',
  'pass_fail',
  'visual',
  'multi_point',
  'tare',
  'calculated',
  'custom_multi_field',
] as const satisfies readonly CriteriaType[];

/**
 * One numbered step of the form, and the cards that answer it.
 *
 * These used to be bare headings between siblings, which left the reader to
 * infer where a step ended — with eleven cards in one column and two steps
 * holding five cards each, that guess was wrong as often as right. The cards
 * are children now, held by a rail down the left, so a step is something you
 * can see the edges of rather than something you have to count.
 *
 * The order is not free: the spec panel follows from the criteria type,
 * acceptance is computed from the sample size, and the derived-calculation
 * card is unlocked by a trigger, so each step depends on the one above it.
 */
function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={`form-section-${step}`}
      // shrink-0: the column is a flex box with its own scroll, so a flex
      // child is free to shrink below its content, and the steps would
      // collapse into one another instead of scrolling.
      // Clipped across, open down. A dropdown is positioned absolutely so it
      // can float over what follows — overflow-hidden caught it and made
      // opening one look like the card was being pushed apart. But the info
      // bubbles on the toggle rows hang past the right edge on a phone, and
      // with nothing clipping them the column scrolled sideways. clip-x with
      // visible-y is the pair that allows both.
      className="shrink-0 overflow-x-clip overflow-y-visible rounded-[24px] bg-white shadow-[0_4px_4px_rgba(0,0,0,0.1)]"
    >
      <div className="flex flex-col gap-1 border-b border-[#eef0f3] px-6 pb-4 pt-6">
        <h3 className="text-[17px] font-semibold tracking-tight text-slate-900">{title}</h3>
        <p className="text-[12px] leading-relaxed text-[#9aa3ad]">{hint}</p>
      </div>
      {/* One panel per step; the groups inside are separated by a rule rather
          than each being a card of its own. Every earlier attempt put a
          surface inside a surface — the thing that had no visible boundary and
          read as clutter. A hairline says the same with nothing drawn. */}
      <div className="flex flex-col divide-y divide-[#eef0f3]">{children}</div>
    </section>
  );
}

/**
 * A field on this page is a filled box, not an outlined one.
 *
 * The form carried both conventions at once — this one white with a hairline,
 * SOFT_INPUT a grey fill with none — so whether a control looked like
 * something you could type in depended on which half of the form it came
 * from. Worse, once the cards became one white panel the outlined version had
 * a white fill on a white ground and the hairline was the only thing left
 * holding it, which is how the sampling dropdown ended up invisible.
 *
 * Fill wins: it survives whatever surface it lands on. The one place a field
 * keeps a white fill is the Stage panel, where white is the contrast against
 * orange — still a fill, still no border.
 */
const FIELD_INPUT =
  'w-full px-3 py-2.5 rounded-[10px] bg-[#f1f3f5] text-sm text-slate-900 transition outline-none placeholder:text-[#bfbfbf] focus:ring-2 focus:ring-emerald-500/25';
/** For a field that sits on the grey rather than on white. */
const SOFT_SELECT_ON_GREY = 'border-[#e0e4ea] bg-transparent hover:border-[#cdd4de]';
const FIELD_LABEL = 'block text-[13px] font-semibold text-slate-700 mb-1.5';
const FIELD_HELPER = 'text-xs text-slate-500 mt-1.5';

// ────────────────────────────────────────────────────────────────────
// เอกสาร GMP card — Figma node 36:2441
// ────────────────────────────────────────────────────────────────────

/**
 * Soft grey field used throughout the GMP card. Sized to match FIELD_INPUT —
 * same padding, type scale and radius as every other field on the page — with
 * only the fill colour coming from the Figma design.
 */
const SOFT_INPUT =
  'w-full px-3 py-2.5 rounded-[10px] bg-[#f1f3f5] text-sm text-slate-900 outline-none transition placeholder:text-[#bfbfbf] focus:ring-2 focus:ring-emerald-500/25';

/**
 * Check_round_fill — the filled tick from the Figma library, exported as-is.
 * Painted with currentColor so the caller sets the colour.
 */
function CheckRoundFill({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3ZM16.6406 8.23145C16.2164 7.87791 15.585 7.93519 15.2314 8.35938L11.6338 12.6777C11.2873 13.0935 11.0921 13.3233 10.9365 13.4648C10.9347 13.4665 10.9325 13.4681 10.9307 13.4697C10.9287 13.4683 10.9259 13.4673 10.9238 13.4658C10.7561 13.3389 10.541 13.1269 10.1582 12.7441L8.70703 11.293C8.31651 10.9024 7.68349 10.9024 7.29297 11.293C6.90245 11.6835 6.90245 12.3165 7.29297 12.707L8.74414 14.1582C9.08528 14.4993 9.41337 14.8313 9.71777 15.0615C10.0043 15.2781 10.3686 15.4835 10.8232 15.5146L11.0234 15.5166L11.2227 15.4961C11.6726 15.4238 12.0165 15.186 12.2822 14.9443C12.5644 14.6876 12.8612 14.3284 13.1699 13.958L16.7686 9.64062C17.1221 9.21638 17.0648 8.58502 16.6406 8.23145Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Acceptance stat — Figma node 60:5647. Icon disc over a label / value / unit
 * stack, on its own white tile inside the tinted header.
 */
function AcceptanceStat({
  icon,
  label,
  value,
  unit,
  color,
  testId,
  surface = 'bg-white',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  /** Fills the disc and colours the number. */
  color: string;
  testId: string;
  /** Tile fill. Stage cards are already white, so their tiles need contrast. */
  surface?: string;
}) {
  return (
    // Fixed width, not content width. Sample sizes run to four digits and the
    // units are different lengths ("ชิ้น" vs "ไม่เกินกี่ชิ้น"), so sizing to
    // content made the three tiles jump about as the numbers changed.
    <div
      data-testid={testId}
      className={cn(
        'flex w-[136px] shrink-0 flex-col items-center gap-1.5 rounded-[16px] px-3 py-2.5',
        surface,
      )}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <div className="flex w-full flex-col items-center gap-1 text-center">
        <span className="text-[10px] font-medium text-black/60">{label}</span>
        <span className="flex max-w-full items-baseline justify-center gap-1.5">
          <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
          <span className="truncate text-[10px] text-black/40">{unit}</span>
        </span>
      </div>
    </div>
  );
}

/** iOS-style switch, sized to the Figma header control. */
function HeaderSwitch({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={onChange}
      className="flex items-center gap-3"
    >
      <span
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-[#27ae60]' : 'bg-[#d9d9d9]',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
      <span className="whitespace-nowrap text-[13px] font-medium text-black">{label}</span>
    </button>
  );
}

/**
 * Check Interval — Figma node 59:4998.
 *
 * The intervals a line supervisor actually picks, as one-tap chips, with an
 * escape hatch for anything else. Replaces the bare number field: typing "30"
 * was the common case and cost four interactions.
 *
 * Which chips appear follows the chosen sampling method (SAMPLING_CADENCE).
 * Stratified and √n + 1 are not clock-driven, so they show their fixed plan
 * instead of an interval the operator cannot actually honour.
 */

/** Chip shell — Figma: 56px tall, 16px radius. */
const INTERVAL_CHIP =
  'flex h-10 items-center justify-center gap-2 rounded-[12px] px-5 transition ' +
  'focus-visible:outline-none';

/**
 * Unchosen chip — Figma node 59:4944: outlined, not filled. The border is
 * inside the 56px box (border-box), so an outlined and a chosen chip still
 * line up.
 */
const INTERVAL_CHIP_OFF =
  'border-[1.5px] border-[#f1f3f5] bg-transparent hover:bg-[#f8f9fa]';

function CheckIntervalChips({
  value,
  onChange,
  theme,
  cadence,
  unit,
  onUnitChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  /** The chosen chip picks up the selected stage's colour. */
  theme: StageTheme;
  /** Sampling rhythm implied by the selected method. */
  cadence: SamplingCadence;
  /** What the interval counts, for methods that do not count minutes. */
  unit: string;
  onUnitChange: (unit: string) => void;
}) {
  const presets = cadence.presets;
  const isPreset = value != null && presets.includes(value);
  // A saved criterion may hold a value outside this method's presets — either
  // typed by hand, or a preset of the method it used to have. Open the custom
  // chip for it rather than showing nothing as selected.
  const [customOpen, setCustomOpen] = React.useState(value != null && !isPreset);
  React.useEffect(() => {
    if (value != null && !presets.includes(value)) setCustomOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, presets.join(',')]);

  const customActive = customOpen && !isPreset;

  // Per-batch methods: show the plan, not an interval picker. The stored
  // checkIntervalMinutes is left untouched — nothing schedules from it, and
  // clearing it is a data change this UI work is not allowed to make.
  if (cadence.mode === 'per_batch') {
    return (
      <div className="pt-5">
        <div
          role="group"
          aria-label="แผนการเก็บตัวอย่าง"
          className="flex flex-wrap items-center gap-4 sm:gap-6"
        >
          {cadence.points.map((point) => (
            <div
              key={point}
              data-testid={`interval-point-${point}`}
              className={cn(INTERVAL_CHIP, 'ring-2', theme.chip.on)}
            >
              <span className={cn('text-[13px] font-semibold', theme.chip.text)}>{point}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-5">
      <div
        role="group"
        aria-label="Check Interval (min)"
        className="flex flex-wrap items-center gap-4 sm:gap-6"
      >
        {presets.map((minutes) => {
          const selected = value === minutes;
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={selected}
              data-testid={`interval-${minutes}`}
              onClick={() => {
                setCustomOpen(false);
                onChange(minutes);
              }}
              className={cn(
                INTERVAL_CHIP,
                selected ? cn('ring-2', theme.chip.on) : INTERVAL_CHIP_OFF,
              )}
            >
              <span className={cn('text-base font-bold', theme.chip.text)}>{minutes}</span>
              <span className="text-[10px] text-black/40">
                {cadence.mode === 'interval' ? (unit || 'หน่วย') : 'นาที'}
              </span>
            </button>
          );
        })}

        {/* Custom — a chip until it is chosen, then the same chip holding an
            input, so the row keeps its shape instead of growing a second one. */}
        {customActive ? (
          <div
            data-testid="interval-custom-field"
            className={cn(INTERVAL_CHIP, 'ring-2', theme.chip.on)}
          >
            <NumberInput
              autoFocus
              ariaLabel="Check Interval (min)"
              min={1}
              value={value}
              onChange={onChange}
              // Spinner arrows are suppressed — they crowd a 56px chip. The
              // global :focus-visible outline is left alone: it is the app's
              // keyboard-focus indicator, not decoration.
              className={cn(
                'w-12 bg-transparent text-center text-base font-bold',
                theme.chip.text,
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
                '[&::-webkit-outer-spin-button]:appearance-none',
              )}
              placeholder="—"
            />
            <span className="text-[10px] text-black/40">
              {cadence.mode === 'interval' ? (unit || 'หน่วย') : 'นาที'}
            </span>
          </div>
        ) : (
          <button
            type="button"
            aria-pressed={false}
            data-testid="interval-custom"
            onClick={() => {
              setCustomOpen(true);
              onChange(null);
            }}
            className={cn(INTERVAL_CHIP, INTERVAL_CHIP_OFF)}
          >
            <span className="text-[13px] text-[#bfbfbf]">
              {cadence.mode === 'interval' ? 'ระบุระยะเอง' : 'ระบุเวลาเอง'}
            </span>
          </button>
        )}

        {/* The unit belongs beside the number, not under it: "20" and "ชิ้น"
            are one statement, and splitting them made the row read as a
            finished answer with a stray question underneath. Disabled until
            there is a number for it to qualify. */}
        {cadence.mode === 'interval' && (
          <label className="flex items-center gap-2">
            <span className="text-[13px] text-[#bfbfbf]">
              หน่วย <span className="text-[#e32727]">*</span>
            </span>
            <select
              aria-label="หน่วยของระยะ"
              data-testid="sampling-unit"
              disabled={value == null}
              value={unit}
              onChange={(e) => onUnitChange(e.target.value)}
              className={cn(
                INTERVAL_CHIP,
                'cursor-pointer appearance-none pl-4 pr-8 text-[13px] font-medium',
                unit ? cn('ring-2', theme.chip.on, theme.chip.text) : INTERVAL_CHIP_OFF,
                !unit && 'text-[#bfbfbf]',
                value == null && 'cursor-not-allowed opacity-50',
              )}
            >
              <option value="">เลือกหน่วย…</option>
              {(cadence.units ?? []).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Numeric input that can actually be emptied.
 *
 * The straightforward `Number(e.target.value) || fallback` turns the empty
 * string into the fallback on the very first keystroke, so the field snaps back
 * to its default and the user cannot clear it to type a new number. This keeps
 * the raw text locally and reports null while it is empty; the caller decides
 * what an empty field means when saving.
 */
function NumberInput({
  value,
  onChange,
  min,
  max,
  className,
  placeholder,
  ariaLabel,
  autoFocus,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  /** Used where the field only appears once the user asks for it. */
  autoFocus?: boolean;
}) {
  const [text, setText] = React.useState(value == null ? '' : String(value));

  // Follow programmatic changes (auto-fill, presets) without fighting the user
  // while they type: only overwrite when the box no longer reflects the value.
  React.useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n: number) => {
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      className={className}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw.trim() === '') {
          setText('');
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (Number.isNaN(n)) return;
        const clamped = clamp(n);
        setText(clamped === n ? raw : String(clamped));
        onChange(clamped);
      }}
    />
  );
}

/** Label above a field, in the grey the design uses. */
function SoftLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-[#bfbfbf]">
        {label}
        {required && <span className="text-[#e32727]"> *</span>}
      </span>
      {children}
    </div>
  );
}

function SoftField({
  label,
  value,
  onChange,
  placeholder,
  autoFilled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Example shown inside the field; disappears as soon as a real value is typed. */
  placeholder?: string;
  /** Marks a value copied in from the linked GMP document. */
  autoFilled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center text-sm text-[#bfbfbf]">
        {label}
        {autoFilled && <AutoBadge />}
      </span>
      <input
        className={SOFT_INPUT}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ────────────────────────────────────────────────────────────────────
// Stage + basics panel — Figma "ข้อมูลพื้นฐาน" block
// (file jA6hPUvPeNEzk74fi5fGEL, node 16:1622): a dark→orange gradient
// surface with the stage picker on the left and the product-form / test-name
// pickers on the right.
// ────────────────────────────────────────────────────────────────────


/**
 * White field on the gradient surface. Only the border is overridden — size,
 * padding and type scale stay on SearchableSelect's default trigger so these
 * match the ordinary fields elsewhere on the page.
 */
/**
 * The fill a field takes on the Stage panel.
 *
 * Same rule as everywhere else — a fill, no border — but white, because white
 * is what contrasts against the orange. It used to only strip the border and
 * lean on the select's white default; once that default became the page's
 * grey, these fields went grey on orange.
 */
const STAGE_FIELD =
  'border-transparent bg-white hover:border-transparent focus:border-transparent focus:ring-0';
// 18px, not the Figma's 20px: the right column is narrower here than in the
// mockup, and 20px wraps "หัวข้อการทดสอบ (Test Name)" onto a second line.
const STAGE_HEADING = 'text-lg font-semibold text-white';

interface StageBasicsPanelProps {
  stage: StageValue;
  onStageChange: (stage: StageValue) => void;
  /** Sub-caption under the heading, like the other cards have. */
  dosageForm: string;
  onDosageFormChange: (value: string) => void;
  /** Dosage forms in scope for the current stage. */
  dosageFormOptions: Array<{ value: string; label: string }>;
  unit: string;
  onUnitChange: (value: string) => void;
  /** Units in scope for the chosen dosage form. */
  unitOptions: SearchableSelectOption[];
  /** Adds a unit the catalog does not carry, typed into the picker's search box. */
  onAddUnit: (unit: string) => void;
  testName: string;
  onTestNameChange: (value: string) => void;
  testOptions: SearchableSelectOption[];
}

function StageBasicsPanel({
  stage,
  onStageChange,
  dosageForm,
  onDosageFormChange,
  dosageFormOptions,
  unit,
  onUnitChange,
  unitOptions,
  onAddUnit,
  testName,
  onTestNameChange,
  testOptions,
}: StageBasicsPanelProps) {
  const theme = STAGE_THEME[stage];
  // Raw material is crude drug — it has no dosage form yet, and the picker only
  // offers powder/other there, so asking for a "รูปแบบยา" contradicts itself.
  const productForm =
    stage === 'raw_material'
      ? { heading: 'ลักษณะวัตถุดิบ', placeholder: 'เลือกลักษณะวัตถุดิบ' }
      : { heading: 'รูปแบบผลิตภัณฑ์', placeholder: 'เลือกรูปแบบยา' };
  return (
    // No fixed height any more: the stage options used to be tall cards that
    // had to be clipped to a 336px surface, and the panel was sized to that
    // clip. They are compact tiles now, so the panel is as tall as it needs to
    // be. Still never clipped itself — the dropdowns on the right must be free
    // to open past the surface.
    <div
      data-testid="stage-basics-panel"
      className={cn('rounded-[24px] bg-gradient-to-l', theme.panel)}
    >
      {/* 50/50. It used to be 60/40 for the tall stage cards; the compact tiles
          need less, and the extra width lets the pickers sit two to a row,
          which is what actually shortens the panel now.
          minmax(0,…) keeps a long option label from widening its track. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,50%)_minmax(0,50%)]">
        {/*
          ── Stage picker ────────────────────────────────────────────
          Three compact tiles in one row.

          The Figma frame (node 16:1639) drew these as tall cards filled with
          grey bars standing in for the criteria of each stage, with the chosen
          one raised above the others and the bottoms clipped by the panel. That
          content was never specified, so the height went entirely on
          placeholders — 291px of card to carry three words and a radio, and it
          set the height of the whole panel. The choice reads the same at a
          fraction of the size.
        */}
        <div className="px-6 pb-6 pt-6">
          <h3 className={STAGE_HEADING} data-testid="stage-code">
            Stage
          </h3>
          {/* Stacked, not three across: at one field's height the tiles are a
              single line of text, and "In Process Control" does not fit a third
              of this column at any width the page is used at. Down the column
              each tile has the whole width and nothing is cut. */}
          <div className="mt-4 flex flex-col gap-2.5">
            {STAGE_OPTIONS.map((opt) => {
              const selected = opt.value === stage;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Stage: ${opt.titleEn} (${opt.titleTh})`}
                  onClick={() => onStageChange(opt.value)}
                  // 42px — the height of the pickers in the next column, so
                  // the whole panel sits on one rhythm. That is a single line
                  // of text, which is why the Thai name is a tooltip below
                  // rather than a second row.
                  title={opt.titleTh}
                  className={cn(
                    'flex h-[42px] items-center gap-2.5 rounded-[12px] px-3 text-left',
                    'shadow-[-2px_2px_8px_rgba(0,0,0,0.1)] outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-white/80',
                    selected ? cn('bg-gradient-to-b', theme.card) : 'bg-white',
                  )}
                >
                  {/* Marker moves to the front of the row: at this height a
                      corner badge would sit on top of the label. The ring is
                      the same 18px as the tick's filled disc, so neither state
                      looks larger than the other. */}
                  {selected ? (
                    <CheckRoundFill className={cn('h-[18px] w-[18px] shrink-0', theme.check)} />
                  ) : (
                    <span
                      aria-hidden
                      className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-[#d9d9d9]"
                    />
                  )}
                  <span className="truncate text-[13px] font-semibold leading-tight text-black">
                    {opt.titleEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Product form + test name ─────────────────────────────── */}
        <div className="flex flex-col gap-5 px-6 pb-6 lg:pl-8 lg:pr-6 lg:pt-6">
          <div className="flex flex-col gap-4">
            <h3 className={STAGE_HEADING}>{productForm.heading}</h3>
            {/* Form and unit share a row: they are one thought — what is being
                made and what it is measured in — and stacking them was costing
                the panel a whole field's height. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SearchableSelect
                testId="stage-dosage-form"
                value={dosageForm}
                onChange={onDosageFormChange}
                options={dosageFormOptions}
                placeholder={productForm.placeholder}
                triggerClassName={STAGE_FIELD}
              />
              <SearchableSelect
                testId="stage-unit"
                value={unit}
                onChange={onUnitChange}
                options={unitOptions}
                // "— ไม่ระบุหน่วย —" used to be an option in the list, so with
                // no unit chosen the box showed that as though it were a
                // choice already made, clear button and all. Having none is
                // the empty state, which is what a placeholder is for.
                placeholder="เลือกหน่วย (ถ้ามี)"
                triggerClassName={STAGE_FIELD}
                onAddNew={onAddUnit}
                addNewLabel="＋ เพิ่มหน่วยใหม่"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className={STAGE_HEADING}>หัวข้อการทดสอบ (Test Name)</h3>
            <SearchableSelect
              testId="stage-test-name"
              value={testName}
              onChange={onTestNameChange}
              options={testOptions}
              placeholder="เลือกหัวข้อทดสอบ"
              triggerClassName={STAGE_FIELD}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────
interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sampleSize: number | null;
  checkIntervalMinutes: number | null;
  isCritical: boolean;
  isActive: boolean;
  dosageForm: string | null;
  criteriaType: string;
  tolerancePercent: number | null;
  specTarget: number | null;
  specTolerancePercent: number | null;
  acceptanceStages: string | AcceptanceStage[] | null;
  // FDA OOS 2006 / PIC/S retest budget. 0 = deviation immediately on round 1 fail.
  // Critical criteria force this to 0 at runtime.
  maxRetestRounds: number;
  // Multi-Point criteria reference a Tare criteria via this FK (id of another
  // ipc_criteria row with criteriaType='tare'). Persisted alongside the
  // tareSourceCode in spec payload to survive criteria-code renames.
  tareSourceCriteriaId: number | null;
  // Optional linked GMP document (soft ref to documents.id) — e.g. test-method SOP.
  gmpDocumentId: number | null;
}

interface Props {
  mode: 'create' | 'edit';
  id?: number;
}

function normalizeRecord(raw: IPCCriteria | undefined): IPCCriteria | undefined {
  if (!raw) return raw;
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    ...raw,
    minValue: toNum(raw.minValue),
    maxValue: toNum(raw.maxValue),
    tolerancePercent: toNum(raw.tolerancePercent) ?? 0,
    specTarget: toNum(raw.specTarget),
    specTolerancePercent: toNum(raw.specTolerancePercent) ?? 0,
    maxRetestRounds: toNum(raw.maxRetestRounds) ?? 1,
    tareSourceCriteriaId: toNum(raw.tareSourceCriteriaId),
    gmpDocumentId: toNum(raw.gmpDocumentId),
    isCritical: !!raw.isCritical,
    isActive: raw.isActive !== false,
    criteriaType: normalizeCriteriaType(raw.criteriaType),
  };
}

// ────────────────────────────────────────────────────────────────────
// Outer wrapper — fetches existing record in edit mode
// ────────────────────────────────────────────────────────────────────
export function IPCCriteriaForm({ mode, id }: Props) {
  const { data: existing, isLoading } = useQuery<IPCCriteria>({
    queryKey: ['ipc-criteria', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/ipc-criteria?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit' && (isLoading || !existing)) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  const normalized = normalizeRecord(existing);
  const initialData: Partial<IPCCriteria> = normalized || {
    code: '', name: '', nameTh: '', testMethod: '', specification: '',
    minValue: null, maxValue: null, unit: '', sampleSize: 5,
    checkIntervalMinutes: 30, isCritical: false, isActive: true,
    dosageForm: null, criteriaType: '', tolerancePercent: 0,
    specTarget: null, specTolerancePercent: 0, acceptanceStages: null,
    maxRetestRounds: 1, tareSourceCriteriaId: null, gmpDocumentId: null,
  };

  return <IPCCriteriaFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} />;
}

// ────────────────────────────────────────────────────────────────────
// Inner form
// ────────────────────────────────────────────────────────────────────
function IPCCriteriaFormInner({ mode, id, initialData }: Props & { initialData: Partial<IPCCriteria> }) {
  const t = useTranslations('masterData.ipcCriteria');
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { dialogState, showConfirm, handleCancel } = useConfirmDialog();
  const [formData, setFormData] = React.useState<Partial<IPCCriteria>>(initialData);
  const [stages, setStages] = React.useState<AcceptanceStage[]>(() =>
    parseAcceptanceStages(initialData.acceptanceStages)
  );
  const [multiStageEnabled, setMultiStageEnabled] = React.useState<boolean>(() =>
    parseAcceptanceStages(initialData.acceptanceStages).length > 0
  );

  // Per-criteria-type structured payloads (pass_fail, visual, text).
  // Numeric uses target/tolerance fields directly.
  const [specPayload, setSpecPayload] = React.useState<SpecPayload | null>(() =>
    parseSpecPayload(initialData.criteriaType ?? 'numeric', initialData.specification)
  );
  // Shared extras (apply regardless of criteria type): use context, SOP step ref,
  // triggers, derived calcs. Persisted into the same `specification` JSON envelope.
  const [sharedExtras, setSharedExtras] = React.useState<SharedSpecExtras>(() =>
    parseSharedExtras(initialData.specification),
  );

  const [autoFilled, setAutoFilled] = React.useState<Set<string>>(new Set());
  const [autoFillNote, setAutoFillNote] = React.useState<string>('');
  const [isCustomName, setIsCustomName] = React.useState(() => {
    if (mode === 'edit' && initialData.name) {
      return !IPC_TEST_CATALOG.some((t) => t.nameEn === initialData.name);
    }
    return false;
  });

  /**
   * Empty until picked, rather than defaulting to Numeric.
   *
   * The default meant a criterion the author had not classified still looked
   * classified — the Numeric fields were open and the preview drew a numeric
   * recorder, so a type could be saved that nobody had actually decided on.
   */
  const criteriaType = (formData.criteriaType || '') as CriteriaType | '';

  // When user switches criteria type, reset structured payload to defaults
  // for that type so the relevant section renders empty fields.
  const handleCriteriaTypeChange = (next: CriteriaType) => {
    setFormData((prev) => ({ ...prev, criteriaType: next }));
    if (next === 'numeric') {
      setSpecPayload(null);
    } else {
      setSpecPayload((prev) => (prev && prev.type === next ? prev : defaultPayload(next)));
    }
  };

  // Test list narrows by stage first, then by dosage form when one is picked.
  // Every section header on the page washes in the selected stage's colour.
  const theme = STAGE_THEME[sharedExtras.stage];
  // Sampling method decides whether an interval applies at all.
  const cadence = cadenceForSamplingMethod(formData.testMethod);
  const stageTests = React.useMemo(() => testsForStage(sharedExtras.stage), [sharedExtras.stage]);
  const filteredTests = React.useMemo(() => {
    if (!formData.dosageForm) return stageTests;
    return stageTests.filter((t) => t.dosageForms.includes(formData.dosageForm!));
  }, [stageTests, formData.dosageForm]);

  const stageDosageFormOptions = React.useMemo(
    () => dosageFormOptionsForStage(sharedExtras.stage),
    [sharedExtras.stage],
  );

  /**
   * Units the user typed in themselves. `unit` is a free-text column, so these
   * save like any other value; they live in state only so the picker can show
   * them again after they are chosen.
   */
  const [customUnits, setCustomUnits] = React.useState<string[]>([]);

  // Scoped by what the test measures and by the product's physical state —
  // never by stage, which has no bearing on units.
  const scopedUnitOptions = React.useMemo(() => {
    const base = unitOptionsForTest(testKeyFromName(formData.name), formData.dosageForm);
    const known = new Set(base.map((u) => u.value));
    // A unit already on the record must stay selectable even if the current
    // test would not offer it — an edited criterion should never lose its unit.
    const extras = [...new Set([...customUnits, formData.unit ?? ''])]
      .filter((u) => u && !known.has(u))
      .map((u) => ({ value: u, label: u, custom: true }));
    return [...base, ...extras];
  }, [formData.name, formData.dosageForm, formData.unit, customUnits]);

  const addCustomUnit = (text: string) => {
    const unit = text.trim();
    if (!unit) return;
    setCustomUnits((prev) => (prev.includes(unit) ? prev : [...prev, unit]));
    setFormData((prev) => ({ ...prev, unit }));
  };

  /**
   * Changing the dosage form can invalidate the chosen unit — swap cfu/g ↔
   * cfu/mL where that is all that changed, and drop anything else out of scope
   * rather than leave a value the picker can no longer display.
   */
  const handleDosageFormChange = (value: string) => {
    const nextForm = value || null;
    const allowed = new Set(unitOptionsForDosageForm(nextForm).map((u) => u.value));
    setFormData((prev) => {
      const adapted = adaptUnitToDosageForm(prev.unit || '', nextForm);
      return {
        ...prev,
        dosageForm: nextForm,
        unit: allowed.has(adapted) ? adapted : '',
      };
    });
  };

  /**
   * Almost every field on this form is derived from the test, and the test list
   * is stage-specific — so after a stage change the leftovers are wrong, not
   * merely stale: the code still carries the old stage's prefix, the unit
   * belongs to a test the new stage does not run. Start the form over.
   *
   * The code is kept when editing: it is the key other rows reference, and
   * regenerating it would rename an existing criteria.
   */
  const resetForStage = (nextStage: StageValue) => {
    setSharedExtras({ ...defaultSharedExtras(), stage: nextStage });
    setFormData((prev) => ({
      code: mode === 'edit' ? prev.code : '',
      name: '', nameTh: '', testMethod: '', specification: '',
      minValue: null, maxValue: null, unit: '', sampleSize: 5,
      checkIntervalMinutes: 30, isCritical: false, isActive: prev.isActive ?? true,
      dosageForm: null, criteriaType: '', tolerancePercent: 0,
      specTarget: null, specTolerancePercent: 0, acceptanceStages: null,
      maxRetestRounds: 1, tareSourceCriteriaId: null, gmpDocumentId: null,
    }));
    setSpecPayload(null);
    setStages([]);
    setMultiStageEnabled(false);
    setIsCustomName(false);
    setAutoFilled(new Set());
    setAutoFillNote('');
    // The form is blank again, so the retest budget is unchosen again — the
    // "1" left in formData is the column default, not a decision.
    setRetestChosen(mode === 'edit');
    setRetestCustom(false);
    setRetestMissingShown(false);
  };

  /** Anything the user would be upset to lose. */
  const hasEnteredData = () =>
    Boolean(
      formData.name ||
        formData.dosageForm ||
        formData.unit ||
        formData.specTarget != null ||
        formData.gmpDocumentId != null ||
        (mode === 'create' && formData.code) ||
        sharedExtras.useContext.length > 0 ||
        criteriaType !== 'numeric' ||
        stages.length > 0 ||
        Object.values(sharedExtras.sopStepRef).some((v) => v.trim() !== ''),
    );

  const handleStageChange = async (nextStage: StageValue) => {
    if (nextStage === sharedExtras.stage) return;
    if (hasEnteredData()) {
      const confirmed = await showConfirm(
        'เปลี่ยน Stage จะล้างข้อมูลที่กรอกไว้ทั้งหมด<br/>เพราะแต่ละ Stage ใช้หัวข้อทดสอบและค่าตั้งต้นคนละชุด<br/><br/>ต้องการเปลี่ยนหรือไม่?',
        'เปลี่ยน Stage',
        'stage-change',
      );
      if (!confirmed) return;
    }
    resetForStage(nextStage);
  };

  const calculatedMinMax = React.useMemo(() => {
    if (formData.specTarget === null || formData.specTarget === undefined) return null;
    return calculateMinMax(
      Number(formData.specTarget),
      Number(formData.specTolerancePercent ?? 0),
    );
  }, [formData.specTarget, formData.specTolerancePercent]);

  React.useEffect(() => {
    if (criteriaType !== 'numeric') return;
    if (calculatedMinMax) {
      setFormData((prev) => ({
        ...prev,
        minValue: calculatedMinMax.min,
        maxValue: calculatedMinMax.max,
      }));
    }
  }, [calculatedMinMax?.min, calculatedMinMax?.max, criteriaType]);

  /**
   * The Multi-Point payload carries its own point count, and the form now
   * shows that number once — in the sample-count card. Mirroring it here
   * keeps the stored payload right without putting a second box on screen
   * for a figure the author has already given.
   */
  React.useEffect(() => {
    if (criteriaType !== 'multi_point') return;
    const n = String(formData.sampleSize ?? '');
    setSpecPayload((prev) =>
      prev?.type === 'multi_point' && prev.pointCount !== n ? { ...prev, pointCount: n } : prev,
    );
  }, [criteriaType, formData.sampleSize]);

  const acceptanceMath = React.useMemo(() => {
    const n = Number(formData.sampleSize) || 0;
    const tol = Number(formData.tolerancePercent) || 0;
    if (n <= 0) return null;
    const allowed = Math.floor((n * tol) / 100);
    return { sampleSize: n, allowedFail: allowed, mustPass: n - allowed };
  }, [formData.sampleSize, formData.tolerancePercent]);

  const stageCount = multiStageEnabled ? stages.length : 1;

  const hasTarget = formData.specTarget !== null && formData.specTarget !== undefined;

  const handleSelectTest = (nameEn: string | null | undefined) => {
    if (!nameEn || nameEn === '__custom__') {
      setIsCustomName(true);
      setFormData((p) => ({
        ...p,
        name: '',
        nameTh: '',
        // A code is generated here for the same reason the catalogue tests get
        // one: there is no Code field to type it into. Without this, a custom
        // topic could be filled in completely and still never save.
        code: mode === 'edit' && p.code ? p.code : suggestCodeForCustom(),
      }));
      setAutoFilled(new Set());
      setAutoFillNote('');
      return;
    }
    setIsCustomName(false);
    const test = findTestByName(nameEn);
    if (!test) return;

    setFormData((prev) => {
      const next: Partial<IPCCriteria> = { ...prev };
      next.name = test.nameEn;
      next.nameTh = test.nameTh;

      const filled = new Set<string>();
      const labels: string[] = [];

      // There is no Code field any more, so on a new criteria the code always
      // follows the current test — otherwise switching test would leave the
      // prefix of the first one behind. An existing record keeps its code:
      // it is the unique key other rows reference.
      if (mode === 'create' || !prev.code?.trim()) {
        next.code = suggestCodeForTest(test);
        filled.add('code');
        labels.push('Code');
      }
      // Take the test's unit when the form has none, and also when the unit
      // it carries belongs to the previous test — "mg" is a fine hardness
      // value to nobody. A unit that is still in scope is left alone, so a
      // deliberate choice within the test's own set survives.
      const unitStillValid = unitOptionsForTest(test.key, prev.dosageForm).some(
        (u) => u.value === (prev.unit ?? ''),
      );
      if (!prev.unit || !unitStillValid) {
        // cfu/g → cfu/mL for liquids; the catalog default assumes a solid.
        next.unit = adaptUnitToDosageForm(test.defaultUnit, prev.dosageForm);
        filled.add('unit');
        if (next.unit) labels.push('Unit');
      }
      next.criteriaType = test.defaultCriteriaType;
      filled.add('criteriaType');

      if (!prev.sampleSize || prev.sampleSize === 5) {
        next.sampleSize = test.defaultSampleSize;
        filled.add('sampleSize');
        labels.push('Sample Size');
      }
      if (!prev.tolerancePercent) {
        next.tolerancePercent = test.defaultTolerancePercent;
        filled.add('tolerancePercent');
        labels.push('Tolerance');
      }
      if (test.defaultCritical && !prev.isCritical) {
        next.isCritical = true;
        filled.add('isCritical');
        labels.push('Critical');
      }

      setAutoFilled(filled);
      setAutoFillNote(labels.length > 0 ? `เติมให้อัตโนมัติ: ${labels.join(' · ')}` : '');

      // Reset spec payload to default for the new criteria type
      setSpecPayload(test.defaultCriteriaType === 'numeric' ? null : defaultPayload(test.defaultCriteriaType));

      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<IPCCriteria> & { acceptanceStages?: AcceptanceStage[] | null }) => {
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const payload = mode === 'edit' ? { ...data, id } : data;
      const res = await fetch('/api/master-data/ipc-criteria', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipc-criteria'] });
      toast.success(mode === 'edit' ? 'Updated' : 'Created', 'IPC criteria saved successfully.');
      router.push('/master-data/ipc-criteria');
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const handleSave = () => {
    if (!criteriaType) {
      toast.error('Validation', 'เลือก "ประเภทเกณฑ์" ก่อนบันทึก');
      return;
    }
    if (!formData.code || !formData.name) {
      toast.error('Validation', 'Code and Test Name are required.');
      return;
    }
    if (criteriaType === 'numeric' && hasTarget) {
      const err = validateSpecInputs(
        Number(formData.specTarget),
        Number(formData.specTolerancePercent ?? 0),
      );
      if (err) {
        toast.error('Validation', err);
        return;
      }
    }
    if (multiStageEnabled && stages.length === 0) {
      toast.error('Validation', 'Multi-Stage โหมด ต้องมี Stage อย่างน้อย 1 ขั้น');
      return;
    }
    // No silent default: saving without a chosen retest budget is the exact
    // failure this control exists to prevent.
    if (retestMissing) {
      setRetestMissingShown(true);
      toast.error('Validation', 'ต้องเลือก "จำนวน Retest สูงสุด" ในหัวข้อ เมื่อไม่ผ่าน ก่อนบันทึก');
      document
        .querySelector('[data-testid="retest-choices"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Serialize per-type payload + shared extras into a single JSON envelope.
    // Numeric criteria still use specTarget/tolerance columns; the envelope only
    // carries the shared extras for them.
    //
    // The time trigger's interval is mirrored from checkIntervalMinutes rather
    // than kept separately — they always meant the same thing, and two editable
    // copies could be saved with different values.
    const extrasToSave: SharedSpecExtras = {
      ...sharedExtras,
      triggers: {
        ...sharedExtras.triggers,
        time: {
          ...sharedExtras.triggers.time,
          every: String(formData.checkIntervalMinutes ?? 30),
        },
      },
    };
    const specification = serializeSpecification(specPayload, extrasToSave, criteriaType);

    saveMutation.mutate({
      ...formData,
      // A field left empty while editing is stored as null; fall back to the
      // same defaults these columns had before it could be cleared.
      sampleSize: formData.sampleSize ?? 5,
      checkIntervalMinutes: formData.checkIntervalMinutes ?? 30,
      tolerancePercent: formData.tolerancePercent ?? 0,
      specTolerancePercent: formData.specTolerancePercent ?? 0,
      // The card states "Retest = 0" for a critical criterion, so that is what
      // gets stored — the value the screen shows and the value saved must not
      // be allowed to differ.
      maxRetestRounds: formData.isCritical ? 0 : formData.maxRetestRounds,
      specification,
      acceptanceStages: multiStageEnabled ? stages : null,
    });
  };

  // ── Stage helpers ────────────────────────────────────────────────
  const addStage = () => setStages((prev) => {
    const next = [...prev, { ...emptyStage() }];
    // Last stage in chain should reject by default; previous stages advance
    return next.map((s, i) => ({
      ...s,
      onFail: i === next.length - 1 ? 'reject_batch' : 'next_stage',
    }));
  });
  const removeStage = (idx: number) => setStages((prev) => {
    const next = prev.filter((_, i) => i !== idx);
    return next.map((s, i) => ({
      ...s,
      onFail: i === next.length - 1 && next.length > 0 ? (s.onFail === 'next_stage' ? 'reject_batch' : s.onFail) : s.onFail,
    }));
  });
  const updateStage = (idx: number, patch: Partial<AcceptanceStage>) =>
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const loadUSPDissolution = () => setStages([...USP_DISSOLUTION_PLAN]);
  const loadUSPUniformity = () => setStages([...USP_UNIFORMITY_PLAN]);

  const cumulative = React.useMemo(() => {
    const out: number[] = [];
    let running = 0;
    for (const s of stages) {
      running += s.sampleSize;
      out.push(running);
    }
    return out;
  }, [stages]);

  const isAutoFilled = (k: string) => autoFilled.has(k);

  // ── Shared extras helpers ─────────────────────────────────────────
  /**
   * Which SOP fields the linked GMP document filled in. Kept so swapping the
   * document replaces its own values while anything typed by hand survives.
   */
  const [gmpAutoFields, setGmpAutoFields] = React.useState<Set<keyof SopStepRef>>(new Set());

  const updateSopStepRef = (key: keyof SopStepRef, value: string) => {
    // Typing over an auto value makes it the user's — a later document swap
    // must not take it back.
    setGmpAutoFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setSharedExtras((prev) => ({ ...prev, sopStepRef: { ...prev.sopStepRef, [key]: value } }));
  };

  /**
   * Mirror the chosen GMP document into the SOP-step reference.
   *
   * Version is left blank on purpose: the document list carries
   * `currentVersionId` — a row id, not the "1.0" string — so filling it would
   * mean an extra request per selection for one optional field.
   */
  const applyGmpDocument = (
    doc: { id: number; documentNumber: string; title: string } | null,
  ) => {
    if (!doc) return;
    const auto: [keyof SopStepRef, string][] = [
      ['sopCode', doc.documentNumber],
      ['stepDescription', doc.title],
      ['link', `/documents/${doc.id}`],
    ];
    const filled = new Set<keyof SopStepRef>();
    setSharedExtras((prev) => {
      const next = { ...prev.sopStepRef };
      for (const [key, value] of auto) {
        if (next[key].trim() === '' || gmpAutoFields.has(key)) {
          next[key] = value;
          filled.add(key);
        }
      }
      return { ...prev, sopStepRef: next };
    });
    setGmpAutoFields(filled);
  };

  // ── Use context → recommended triggers ────────────────────────────
  const recommendedTriggers = React.useMemo(
    () => triggersForContexts(sharedExtras.useContext),
    [sharedExtras.useContext],
  );

  /**
   * Only the contexts that belong to the chosen stage. A criterion on a raw
   * material is never "ก่อนปิดรุ่น", and a release check is never "Line
   * Clearance" — offering all eight everywhere made the user do the filtering.
   *
   * Nothing is stranded by this: changing stage resets the form, contexts
   * included, so a selection can never be left hidden behind a stage switch.
   */
  const stageContextOptions = React.useMemo(
    () => contextOptionsForStage(sharedExtras.stage),
    [sharedExtras.stage],
  );

  /**
   * The rest of the catalogue, reachable but out of the way.
   *
   * The stage mapping is our reading of where each context belongs, not a
   * rule — a plant may check incoming material again at release, or run a
   * line clearance on a raw-material stage we did not anticipate. Anything
   * already chosen stays in the main list whatever stage it came from, so a
   * saved setting is never hidden behind a disclosure.
   */
  const [showOtherContexts, setShowOtherContexts] = React.useState(false);
  const shownContextOptions = React.useMemo(
    () =>
      USE_CONTEXT_OPTIONS.filter(
        (o) =>
          stageContextOptions.some((s) => s.value === o.value) ||
          sharedExtras.useContext.includes(o.value),
      ),
    [stageContextOptions, sharedExtras.useContext],
  );
  const otherContextOptions = React.useMemo(
    () => USE_CONTEXT_OPTIONS.filter((o) => !shownContextOptions.includes(o)),
    [shownContextOptions],
  );

  const triggerIsOn = (key: TriggerKey) =>
    key === 'oncePerBatch'
      ? sharedExtras.triggers.oncePerBatch.on
      : sharedExtras.triggers[key].on;

  /**
   * A trigger the current context recommends but that is switched off can only
   * have got that way by hand — the context switches its own triggers on. So
   * "off while recommended" *is* the record of a dismissal, and adding another
   * context must not undo it.
   */
  const triggerWasDismissed = (key: TriggerKey) =>
    recommendedTriggers.has(key) && !triggerIsOn(key);

  const [showOtherTriggers, setShowOtherTriggers] = React.useState(false);

  /**
   * Whether the retest budget was chosen by a person.
   *
   * The field used to open on 1, which reads exactly like a decision someone
   * made — so a criterion that nobody looked at was saved with a one-round
   * budget. Nothing is preselected now, and this flag is what tells "chose 1"
   * apart from "never touched it".
   *
   * Editing an existing criterion counts as chosen: its number was already
   * saved once, and re-asking for every old record would be a migration, not a
   * safeguard.
   */
  const [retestChosen, setRetestChosen] = React.useState(mode === 'edit');
  const [retestCustom, setRetestCustom] = React.useState(false);
  /** Set by a blocked save, so the warning only appears once it is earned. */
  const [retestMissingShown, setRetestMissingShown] = React.useState(false);

  const retestMissing = !formData.isCritical && !retestChosen;

  const chooseRetest = (rounds: number, custom = false) => {
    setRetestChosen(true);
    setRetestCustom(custom);
    setRetestMissingShown(false);
    setFormData((prev) => ({ ...prev, maxRetestRounds: rounds }));
  };

  /**
   * Derived values (Yield, %LOD) are summed up once the batch is finished, so
   * the card only makes sense when the criterion is actually recorded at that
   * point — once per batch, or at a milestone. Tied to the triggers alone and
   * not to the Use Context: a hidden card must have one reason, not two.
   */
  const derivedCalcUnlocked =
    sharedExtras.triggers.oncePerBatch.on || sharedExtras.triggers.milestone.on;


  /**
   * Picking a context switches its triggers on; dropping one leaves everything
   * as it is. Silently undoing a setting the user can no longer see would be
   * worse than leaving an extra trigger enabled, which is at least visible.
   */
  const toggleUseContext = (value: string) => {
    const opt = USE_CONTEXT_OPTIONS.find((o) => o.value === value);
    const isOn = sharedExtras.useContext.includes(value);
    setSharedExtras((prev) => {
      const useContext = isOn
        ? prev.useContext.filter((v) => v !== value)
        : [...prev.useContext, value];
      if (isOn || !opt) return { ...prev, useContext };

      const t = { ...prev.triggers };
      const wanted = opt.triggers.filter((k) => !triggerWasDismissed(k));
      if (wanted.includes('time')) t.time = { ...t.time, on: true };
      if (wanted.includes('quantity')) t.quantity = { ...t.quantity, on: true };
      if (wanted.includes('oncePerBatch')) t.oncePerBatch = { on: true };
      if (wanted.includes('milestone')) {
        t.milestone = {
          on: true,
          options: t.milestone.options.map((o) =>
            opt.milestoneIds?.includes(o.id) ? { ...o, on: true } : o,
          ),
        };
      }
      if (wanted.includes('event')) {
        t.event = {
          on: true,
          options: t.event.options.map((o) =>
            opt.eventIds?.includes(o.id) ? { ...o, on: true } : o,
          ),
        };
      }
      return { ...prev, useContext, triggers: t };
    });
  };

  const updateTriggers = (patch: (t: Triggers) => Triggers) =>
    setSharedExtras((prev) => ({ ...prev, triggers: patch(prev.triggers) }));

  const toggleMilestoneOption = (id: string) =>
    updateTriggers((t) => ({
      ...t,
      milestone: {
        ...t.milestone,
        options: t.milestone.options.map((o) => (o.id === id ? { ...o, on: !o.on } : o)),
      },
    }));

  const toggleEventOption = (id: string) =>
    updateTriggers((t) => ({
      ...t,
      event: {
        ...t.event,
        options: t.event.options.map((o) => (o.id === id ? { ...o, on: !o.on } : o)),
      },
    }));

  /**
   * The five triggers as data rather than five fixed slots, so the recommended
   * ones can be shown up front and the rest folded away without any of them
   * being written twice.
   */
  const triggerCards: { key: TriggerKey; node: React.ReactNode }[] = [
    {
      key: 'time' as const,
      node: (
        <TriggerCard
          recommended={recommendedTriggers.has('time')}
          testId="trigger-time"
          icon={<Clock className="h-4 w-4" />}
          title="ตามช่วงเวลา (Time)"
          desc="ทุก N นาที"
          info="ระบบเตือนให้เก็บตัวอย่างตามรอบเวลา เช่น ทุก 30 นาที ตลอดการผลิต — ใช้ค่าจากการ์ด แผนการสุ่ม"
          on={sharedExtras.triggers.time.on}
          onToggle={() => updateTriggers((t) => ({ ...t, time: { ...t.time, on: !t.time.on } }))}
        >
          {/*
            Read-only on purpose. The interval used to be editable in
            two places — here and "Check Interval" under Sampling Plan —
            which let the two disagree with nothing to reconcile them.
            Sampling Plan owns the value now (it is a real column and
            part of the Excel import template); this only mirrors it.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">ทุก</span>
            <span className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {formData.checkIntervalMinutes ?? 30}
            </span>
            <span className="text-xs text-slate-500">นาที</span>
            <span className="text-[11px] text-slate-400">
              — แก้ค่าที่การ์ด แผนการสุ่ม
            </span>
          </div>
        </TriggerCard>
      ),
    },
    {
      key: 'quantity' as const,
      node: (
        <TriggerCard
          recommended={recommendedTriggers.has('quantity')}
          testId="trigger-quantity"
          icon={<Package className="h-4 w-4" />}
          title="ตามจำนวนผลิต (Quantity)"
          desc="ทุก N หน่วย / % ของ batch"
          info="เตือนตามจำนวนที่ผลิตได้ เช่น ทุก 1,000 หน่วย หรือทุก 25% ของ batch เหมาะกับรุ่นที่ใช้เวลาผลิตไม่แน่นอน"
          on={sharedExtras.triggers.quantity.on}
          onToggle={() => updateTriggers((t) => ({ ...t, quantity: { ...t.quantity, on: !t.quantity.on } }))}
        >
          {(() => {
            const q = sharedExtras.triggers.quantity;
            const setQ = (patch: Partial<typeof q>) =>
              updateTriggers((t) => ({ ...t, quantity: { ...t.quantity, ...patch } }));
            const unitName = q.unit.trim() || 'หน่วย';
            return (
              <div className="flex flex-col gap-4">
                {/* Two buttons rather than a <select>: there are only two modes
                    and each needs a line of explanation, which a dropdown
                    cannot show until it is opened. Same control as the tare
                    mode and the retest budget elsewhere on this page. */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { v: 'fixed' as const, t: 'ตามจำนวนหน่วย', d: 'เช่น ทุก 1,000 เม็ด' },
                    { v: 'percent' as const, t: 'ตาม % ของ batch', d: 'เช่น ทุก 25% ของรุ่น' },
                  ].map((opt) => {
                    const active = q.mode === opt.v;
                    return (
                      <button
                        type="button"
                        key={opt.v}
                        data-testid={`quantity-mode-${opt.v}`}
                        aria-pressed={active}
                        onClick={() => setQ({ mode: opt.v })}
                        className={cn(
                          'flex flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors',
                          active
                            ? 'border-[#2f6fd0] bg-[#eef3fc]'
                            : 'border-[#e1e4e8] bg-white hover:border-[#9db9e8]',
                        )}
                      >
                        <span
                          className={cn(
                            'text-[13px] font-semibold',
                            active ? 'text-[#1f4e9c]' : 'text-black',
                          )}
                        >
                          {opt.t}
                        </span>
                        <span className="text-[11px] text-[#bfbfbf]">{opt.d}</span>
                      </button>
                    );
                  })}
                </div>

                {q.mode === 'fixed' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SoftLabel label="ตรวจทุกกี่หน่วย">
                      <input
                        type="number"
                        min={1}
                        className={SOFT_INPUT}
                        placeholder="1000"
                        aria-label="ตรวจทุกกี่หน่วย"
                        data-testid="quantity-every"
                        value={q.every}
                        onChange={(e) => setQ({ every: e.target.value })}
                      />
                    </SoftLabel>
                    <SoftLabel label="หน่วยนับ">
                      <input
                        className={SOFT_INPUT}
                        placeholder="เช่น เม็ด, ขวด, กก."
                        aria-label="หน่วยนับ"
                        data-testid="quantity-unit"
                        value={q.unit}
                        onChange={(e) => setQ({ unit: e.target.value })}
                      />
                    </SoftLabel>
                  </div>
                ) : (
                  // Same grid as the fixed mode, so switching between the two
                  // does not move the field or stretch it across the card.
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SoftLabel label="ตรวจทุกกี่ % ของ batch">
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          // The stepper arrows would sit under the "%" suffix.
                          className={cn(
                            SOFT_INPUT,
                            'pr-8 [appearance:textfield]',
                            '[&::-webkit-inner-spin-button]:appearance-none',
                            '[&::-webkit-outer-spin-button]:appearance-none',
                          )}
                          placeholder="25"
                          aria-label="ตรวจทุกกี่ % ของ batch"
                          data-testid="quantity-percent"
                          value={q.percent}
                          onChange={(e) => setQ({ percent: e.target.value })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#bfbfbf]">
                          %
                        </span>
                      </div>
                    </SoftLabel>
                  </div>
                )}

                {/* Reads the setting back, the way the retest budget does — the
                    two numbers mean nothing until they are put in a sentence. */}
                {(q.mode === 'fixed' ? q.every.trim() : q.percent.trim()) === '' ? (
                  <p className="text-[11px] text-[#bfbfbf]">
                    กรอกตัวเลขเพื่อกำหนดรอบการเก็บตัวอย่าง
                  </p>
                ) : (
                  <p
                    data-testid="quantity-readback"
                    className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#1a8a4a]"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {q.mode === 'fixed'
                        ? `ผลิตครบทุก ${q.every} ${unitName} → เตือนให้เก็บตัวอย่าง 1 ครั้ง`
                        : `ผลิตได้ทุก ${q.percent}% ของรุ่น → เตือนให้เก็บตัวอย่าง 1 ครั้ง (รุ่นละ ${
                            Number(q.percent) > 0 ? Math.floor(100 / Number(q.percent)) : 0
                          } ครั้ง)`}
                    </span>
                  </p>
                )}
              </div>
            );
          })()}
        </TriggerCard>
      ),
    },
    {
      key: 'milestone' as const,
      node: (
        <TriggerCard
          recommended={recommendedTriggers.has('milestone')}
          testId="trigger-milestone"
          icon={<Target className="h-4 w-4" />}
          title="ที่ milestone"
          desc="ตามขั้นตอนสำคัญใน batch"
          info="เตือนที่ขั้นตอนสำคัญของรุ่นผลิต เช่น เริ่มผลิต กลางรุ่น ก่อนปิดรุ่น — ผูกกับความคืบหน้า ไม่ใช่เวลา"
          on={sharedExtras.triggers.milestone.on}
          onToggle={() => updateTriggers((t) => ({ ...t, milestone: { ...t.milestone, on: !t.milestone.on } }))}
        >
          <div className="flex flex-wrap gap-2">
            {sharedExtras.triggers.milestone.options.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => toggleMilestoneOption(opt.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  opt.on
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300',
                )}
              >
                {opt.label ?? opt.id}
              </button>
            ))}
          </div>
        </TriggerCard>
      ),
    },
    {
      key: 'event' as const,
      node: (
        <TriggerCard
          recommended={recommendedTriggers.has('event')}
          testId="trigger-event"
          icon={<Zap className="h-4 w-4" />}
          title="เมื่อมีเหตุการณ์ (Event)"
          desc="changeover / lot change / cleaning / parameter / maintenance"
          info="เตือนเมื่อเกิดเหตุการณ์ที่อาจกระทบคุณภาพ เช่น เปลี่ยนล็อตวัตถุดิบ ทำความสะอาดเครื่อง ปรับพารามิเตอร์ ซ่อมบำรุง"
          on={sharedExtras.triggers.event.on}
          onToggle={() => updateTriggers((t) => ({ ...t, event: { ...t.event, on: !t.event.on } }))}
        >
          <div className="flex flex-wrap gap-2">
            {sharedExtras.triggers.event.options.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => toggleEventOption(opt.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  opt.on
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300',
                )}
              >
                {opt.label ?? opt.id}
              </button>
            ))}
          </div>
        </TriggerCard>
      ),
    },
    {
      key: 'oncePerBatch' as const,
      node: (
        <TriggerCard
          recommended={recommendedTriggers.has('oncePerBatch')}
          testId="trigger-once"
          icon={<RotateCcw className="h-4 w-4" />}
          title="ครั้งเดียวต่อ batch"
          desc="บันทึกเพียง 1 ครั้งตลอด batch"
          info="บันทึกผลเพียงครั้งเดียวต่อรุ่นผลิต ไม่ต้องเก็บซ้ำระหว่างทาง — ใช้กับหัวข้อที่วัดได้ครั้งเดียวต่อรุ่น เช่น ผลเพาะเชื้อ"
          on={sharedExtras.triggers.oncePerBatch.on}
          onToggle={() => updateTriggers((t) => ({ ...t, oncePerBatch: { on: !t.oncePerBatch.on } }))}
        />
      ),
    },
  ];

  /**
   * With a context chosen, only its triggers are shown up front — plus any
   * trigger already switched on, which is never folded away: a setting that is
   * saved but invisible is exactly the kind of thing a GMP record must not have.
   */
  const contextChosen = sharedExtras.useContext.length > 0;
  const shownTriggers = triggerCards.filter(
    (c) => !contextChosen || recommendedTriggers.has(c.key) || triggerIsOn(c.key),
  );
  const foldedTriggers = triggerCards.filter((c) => !shownTriggers.includes(c));

  const addDerivedCalc = () => setSharedExtras((prev) => ({
    ...prev,
    derivedCalcs: [
      ...prev.derivedCalcs,
      {
        id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '', formula: '', sources: '', resultUnit: '',
        triggerWhen: '', acceptanceMin: '', acceptanceMax: '',
        onFail: 'reject', note: '',
      },
    ],
  }));

  const updateDerivedCalc = (id: string, patch: Partial<DerivedCalc>) =>
    setSharedExtras((prev) => ({
      ...prev,
      derivedCalcs: prev.derivedCalcs.map((dc) => (dc.id === id ? { ...dc, ...patch } : dc)),
    }));

  const removeDerivedCalc = (id: string) =>
    setSharedExtras((prev) => ({
      ...prev,
      derivedCalcs: prev.derivedCalcs.filter((dc) => dc.id !== id),
    }));

  const activeTriggerCount = (() => {
    const t = sharedExtras.triggers;
    return [t.time.on, t.quantity.on, t.milestone.on, t.event.on, t.oncePerBatch.on].filter(Boolean).length;
  })();

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  // Same container as the other master-data pages. A max-w-7xl cap here left
  // this page visibly inset while every list page beside it ran full width.
  //
  // From lg up the page owns its own scrolling, which is what MainLayout
  // expects ("pages handle their own scrolling"). It also has to: MainLayout's
  // <main> is overflow-hidden, and an overflow-hidden ancestor becomes the
  // containing block for position:sticky — so with the window doing the
  // scrolling, the preview column could never stick to anything.
  return (
    <div
      className={cn(
        'flex flex-col gap-5 p-4 md:p-6 w-full max-w-full box-border',
        'lg:h-[calc(100vh-3rem)] lg:min-h-0 lg:overflow-y-auto',
        // From xl the two columns scroll instead of the page. A sticky column
        // could never solve this on its own: until the page had been scrolled
        // past the header the column was not pinned yet, so its bottom — the
        // CREATE button — sat below the fold no matter what height it was
        // given. Handing each column the exact height that is left removes the
        // guesswork, and the pointer scrolls whichever one it is over.
        'xl:overflow-hidden',
      )}
      style={{ fontFamily: 'var(--font-inter), var(--font-sarabun), system-ui, -apple-system, sans-serif' }}
    >
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit QC & IPC Criteria' : 'New QC & IPC Criteria'}
        subtitle={mode === 'edit' ? `Editing ${initialData.name || ''}` : 'สร้างเกณฑ์การควบคุมคุณภาพการผลิต'}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'QC & IPC Criteria', href: '/master-data/ipc-criteria' },
          { label: mode === 'edit' ? 'Edit' : 'New' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 xl:min-h-0 xl:flex-1">
        {/* ─── Form column (2/3) ─────────────────────────────────── */}
        {/* pr-1 keeps the card shadows off the scrollbar. */}
        <div
          data-testid="form-column"
          className="xl:col-span-2 flex flex-col gap-5 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
        >
          {/* The filter panel is the page's own opening surface — it was never
              a group inside a step, and wrapping it in a white card put a card
              around a panel for no reason. */}


          {/*
            Stage + product form + test name — Figma "ข้อมูลพื้นฐาน" panel.
            Sits outside the white form card as its own surface, per the design.
          */}
          <StageBasicsPanel
            stage={sharedExtras.stage}
            onStageChange={handleStageChange}
            dosageForm={formData.dosageForm || ''}
            onDosageFormChange={handleDosageFormChange}
            dosageFormOptions={stageDosageFormOptions}
            unit={formData.unit || ''}
            onUnitChange={(v) => setFormData({ ...formData, unit: v || '' })}
            unitOptions={scopedUnitOptions}
            onAddUnit={addCustomUnit}
            testName={isCustomName ? '__custom__' : formData.name || ''}
            onTestNameChange={handleSelectTest}
            testOptions={[
              ...filteredTests.map((t): SearchableSelectOption => ({
                value: t.nameEn,
                label: `${t.nameEn} — ${t.nameTh}`,
              })),
              { value: '__custom__', label: '➕ เพิ่มหัวข้อใหม่ (Add Custom)' },
            ]}
          />

          {/* The catalogue count moved up into the Stage panel as its
              description; only the transient auto-fill confirmation is left. */}
          {(autoFillNote || isCustomName) && (
            <div className="flex flex-col gap-3">
            {autoFillNote && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="flex-1 font-medium">{autoFillNote}</span>
                <button
                  type="button"
                  onClick={() => { setAutoFilled(new Set()); setAutoFillNote(''); }}
                  className="text-emerald-600 hover:text-emerald-800 text-[11px] underline"
                >
                  รับทราบ
                </button>
              </div>
            )}

              {/* Custom name fields */}
              {isCustomName && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div>
                    <label className={FIELD_LABEL}>Name (EN) <span className="text-red-500">*</span></label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="เช่น Tablet Friability"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>ชื่อ (TH)</label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="เช่น ความเปราะของเม็ดยา"
                      value={formData.nameTh || ''}
                      onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Code is generated from the Test Name and shown in place of the
                  "Stage" caption on the panel above. Criteria Type moved into
                  its own card below (Figma node 42:2473). */}
            </div>
          )}


          <FormSection step={1} title="เอกสาร GMP" hint="เลือกเอกสารควบคุม เช่น วิธีทดสอบ/SOP — SOP · Version · Step # · Link">
          {/*
            เอกสาร GMP + SOP step reference — Figma node 36:2441.
            Its own surface, deliberately outside the basic-information card.
          */}
          <div
            data-testid="gmp-document-card"
            className="px-6 py-5"
          >
            {/* Header on the pale stage-tinted surface */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {/* The step heading above already names this group; a second
                    copy of the title inside it says nothing new. */}
                {/*
                  DevExtreme's "filled" editor reserves ~15px of top padding for
                  a floating label, so at 40px the text sits low instead of
                  centred. Zero that padding out and match the 14px type scale
                  used by the other fields.
                */}
                <div className="[&_.dx-placeholder:before]:!py-0 [&_.dx-placeholder]:!text-sm [&_.dx-texteditor-input]:!min-h-0 [&_.dx-texteditor-input]:!py-0 [&_.dx-texteditor-input]:!text-sm">
                  <GmpDocumentSelect
                    value={formData.gmpDocumentId ?? null}
                    onValueChange={(docId) => setFormData({ ...formData, gmpDocumentId: docId })}
                    onDocumentChange={applyGmpDocument}
                    placeholder="เลือกเอกสาร"
                    // DevExtreme's own editor height is 50px; 40 lines it up
                    // with the plain inputs below it.
                    height={40}
                  />
                </div>
              </div>
            </div>

            {/* SOP step reference */}
            <div className="flex flex-col gap-6 pt-5">
              {/* items-end keeps the four inputs on one line even when a
                  label wraps, as the SOP Code one does in Thai. */}
              <div className="grid grid-cols-1 items-end gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <SoftField
                  label="SOP Code"
                  placeholder="เช่น SOP-PRD-001"
                  value={sharedExtras.sopStepRef.sopCode}
                  onChange={(v) => updateSopStepRef('sopCode', v)}
                  autoFilled={gmpAutoFields.has('sopCode')}
                />
                {/* No auto value: the document list carries a version *id*,
                    not the printed version number. */}
                <SoftField
                  label="Version"
                  placeholder="เช่น 1.0"
                  value={sharedExtras.sopStepRef.sopVersion}
                  onChange={(v) => updateSopStepRef('sopVersion', v)}
                />
                <SoftField
                  label="Step #"
                  value={sharedExtras.sopStepRef.stepNumber}
                  onChange={(v) => updateSopStepRef('stepNumber', v)}
                />
                <SoftField
                  label="Link (URL)"
                  value={sharedExtras.sopStepRef.link}
                  onChange={(v) => updateSopStepRef('link', v)}
                  autoFilled={gmpAutoFields.has('link')}
                />
              </div>
              <div className="flex flex-col gap-2">
                {gmpAutoFields.has('stepDescription') && (
                  <span className="flex items-center text-sm text-[#bfbfbf]">
                    คำอธิบายขั้นตอน
                    <AutoBadge />
                  </span>
                )}
                <input
                  className={SOFT_INPUT}
                  placeholder="คำอธิบายขั้นตอน"
                  aria-label="คำอธิบายขั้นตอน"
                  data-testid="sop-step-description"
                  value={sharedExtras.sopStepRef.stepDescription}
                  onChange={(e) => updateSopStepRef('stepDescription', e.target.value)}
                />
              </div>
            </div>
          </div>
          </FormSection>

          <FormSection step={2} title="ประเภทเกณฑ์" hint="กำหนดว่าการเก็บตัวอย่างและเกณฑ์การพิจารณาจะกางช่องอะไรออกมา">

          <div
            data-testid="criteria-type-card"
            className="px-6 py-5"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                <SearchableSelect
                  // Says what is missing; the component's generic "เลือก..."
                  // does not, and this is the one field the rest of the form
                  // waits on.
                  placeholder={t('criteriaType.placeholder')}
                  value={criteriaType}
                  onChange={(v) => handleCriteriaTypeChange(v as CriteriaType)}
                  /* Thai leads in Thai — the labels used to open with the
                     English term, so the reader met the loanword first and the
                     Thai only in the gloss. English terms that carry no meaning
                     for a Thai reader mid-sentence (aggregate, reference,
                     criteria, multi_point) are gone; the ones that are the
                     industry's own names for the method are kept in brackets
                     after the Thai. */
                  options={CRITERIA_TYPE_VALUES.map((value) => ({
                    value,
                    label: t(`criteriaType.options.${value}`),
                  }))}
                  showClear={false}
                />
              </div>
            </div>

          </div>
          </FormSection>

          <FormSection step={3} title="การเก็บตัวอย่าง" hint="ใช้กรณีไหน · จังหวะไหน · หยิบอย่างไร · กี่หน่วย · หัก Tare อย่างไร">

          {/* ── Use Context — ตรวจไปเพื่ออะไร ─────────────────────────
              Placed above "ตรวจสอบเมื่อ" because it answers the question that
              comes first: the purpose decides the timing, not the other way
              round. Scoped to production and to QC of product and raw material. */}
          <div
            data-testid="use-context-card"
            className="px-6 py-5"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-black">Use Context</h4>
                  <p className="text-xs text-[#bfbfbf]">
                    เลือกได้หลายข้อ — ระบบจะเปิด &quot;ตรวจสอบเมื่อ&quot; ที่เข้ากับกรณีนั้นให้
                  </p>
                </div>
                <span
                  data-testid="use-context-count-pill"
                  className="rounded-full bg-white px-3 py-1 text-xs text-black shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                >
                  เลือก {sharedExtras.useContext.length}/{USE_CONTEXT_OPTIONS.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
              {shownContextOptions.map((opt) => {
                const active = sharedExtras.useContext.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    data-testid={`use-context-${opt.value}`}
                    aria-pressed={active}
                    onClick={() => toggleUseContext(opt.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-[14px] p-3 text-left transition-colors',
                      active ? 'bg-[#e8effc]' : 'bg-[#f1f3f5] hover:bg-[#e9ecf0]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors',
                        active ? 'border-[#2f6fd0] bg-[#2f6fd0] text-white' : 'border-[#d9d9d9]',
                      )}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span
                        className={cn(
                          'text-[13px] font-semibold',
                          active ? 'text-[#1f4e9c]' : 'text-black',
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[11px] leading-tight text-[#bfbfbf]">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {otherContextOptions.length > 0 && (
              // Same 12px the tiles above are spaced by — it sat at 4, so the
              // expander looked stuck to the last tile rather than being the
              // next item in the same list.
              <div className="pt-3">
                <button
                  type="button"
                  data-testid="toggle-other-contexts"
                  aria-expanded={showOtherContexts}
                  onClick={() => setShowOtherContexts((v) => !v)}
                  // Filled like every other control on the page: as bare text it
                  // read as a caption, with nothing to say it could be opened.
                  className="flex w-full items-center gap-2 rounded-[10px] bg-[#f1f3f5] px-3 py-2.5 text-[13px] font-medium text-[#6b7280] transition hover:bg-[#e9ecf0] hover:text-[#2f6fd0]"
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', showOtherContexts && 'rotate-180')}
                  />
                  ตัวเลือกอื่นที่ไม่ค่อยใช้กับ stage นี้ ({otherContextOptions.length})
                </button>

                {showOtherContexts && (
                  <>
                    {/* mt-3: the revealed options are the next rows of the same
                        list, so they stand off the expander by the same 12px
                        that separates every other tile — they were flush
                        against it. */}
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {otherContextOptions.map((opt) => (
                        <button
                          type="button"
                          key={opt.value}
                          data-testid={`use-context-${opt.value}`}
                          aria-pressed={false}
                          onClick={() => toggleUseContext(opt.value)}
                          className={cn(
                            'flex items-start gap-3 rounded-[14px] p-3 text-left transition-colors',
                            'bg-[#f1f3f5] hover:bg-[#e9ecf0]',
                          )}
                        >
                          <span
                            aria-hidden
                            className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 border-[#d9d9d9]"
                          />
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="text-[13px] font-semibold text-black">{opt.label}</span>
                            <span className="text-[11px] leading-tight text-[#bfbfbf]">{opt.desc}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── ตรวจสอบเมื่อ — Figma node 6:4198 ───────────────────────
              One card per trigger, exactly as the frame draws it. They are
              independent choices, not a single setting with five parts, so
              they get five surfaces rather than five rows in one. */}
          <div data-testid="triggers-card" className="flex flex-col gap-2.5 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-black">ตรวจสอบเมื่อ</h4>
                <p className="text-xs text-[#bfbfbf]">
                  {contextChosen
                    ? 'แสดงเฉพาะที่เข้ากับกรณีที่เลือก — ตัวอื่นกดกางดูได้'
                    : 'เลือกได้หลายแบบ — เปิด toggle เพื่อตั้งรายละเอียด'}
                </p>
              </div>
              {/* Counts all five however many are on screen, so folding a card
                  away never makes the number look wrong. */}
              <span
                data-testid="trigger-count-pill"
                className="rounded-full bg-white px-3 py-1 text-xs text-black shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              >
                เปิด {activeTriggerCount}/5
              </span>
            </div>

            {shownTriggers.map((c) => (
              <React.Fragment key={c.key}>{c.node}</React.Fragment>
            ))}

            {foldedTriggers.length > 0 && (
              <>
                <button
                  type="button"
                  data-testid="toggle-other-triggers"
                  aria-expanded={showOtherTriggers}
                  onClick={() => setShowOtherTriggers((v) => !v)}
                  className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-medium text-[#6b7280] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition hover:text-[#2f6fd0]"
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', showOtherTriggers && 'rotate-180')}
                  />
                  ตัวเลือกอื่นที่ไม่ค่อยใช้กับกรณีนี้ ({foldedTriggers.length})
                </button>
                {showOtherTriggers &&
                  foldedTriggers.map((c) => (
                    <React.Fragment key={c.key}>{c.node}</React.Fragment>
                  ))}
              </>
            )}
          </div>

          {/* ── แผนการสุ่ม — Figma node 57:3722 ────────────────────────
              Its own card, same two-part shape as เอกสาร GMP and ประเภทเกณฑ์:
              a stage-tinted header holding the required choice, then a plain
              white body for the follow-up field.

              Field sizing follows the rest of the page (SOFT_INPUT / the
              standard select trigger) rather than the frame's 56px boxes —
              the form was deliberately standardised on the smaller field
              earlier, and a lone 56px row here would stand out. */}
          <div
            data-testid="sampling-plan-card"
            className="px-6 py-5"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-black">
                    แผนการสุ่ม <span className="text-[#e32727]">*</span>
                  </h4>
                  <p className="text-xs text-[#bfbfbf]">GMP / USP Standard</p>
                </div>
                <SearchableSelect
                  testId="sampling-method"
                  value={formData.testMethod || ''}
                  onChange={(v) => {
                    // The interval means different things under different
                    // methods — 20 minutes under Random, every 20th unit under
                    // Systematic. Carrying the old number across would keep the
                    // digits and silently change what they say, so the choice
                    // is asked for again.
                    const before = cadenceForSamplingMethod(formData.testMethod).mode;
                    const after = cadenceForSamplingMethod(v || null).mode;
                    setFormData({
                      ...formData,
                      testMethod: v || null,
                      checkIntervalMinutes: before === after ? formData.checkIntervalMinutes : null,
                    });
                    if (before !== after) setSharedExtras((prev) => ({ ...prev, samplingUnit: '' }));
                  }}
                  options={SAMPLING_METHOD_OPTIONS}
                  placeholder="เลือกวิธีสุ่ม"
                />
              </div>
            </div>

            <CheckIntervalChips
              value={formData.checkIntervalMinutes ?? null}
              onChange={(v) => setFormData({ ...formData, checkIntervalMinutes: v })}
              theme={theme}
              cadence={cadence}
              unit={sharedExtras.samplingUnit}
              onUnitChange={(u) => setSharedExtras((prev) => ({ ...prev, samplingUnit: u }))}
            />
          </div>

          {/* A4 — จำนวนตัวอย่าง. The only sample-count box in the form: the
              Multi-Point panel used to carry a second one of its own, and the
              acceptance card a third, so three fields described one number. */}
          <div data-testid="sample-count-card" className="px-6 py-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-black">จำนวนตัวอย่าง</h4>
                <p className="text-xs text-[#bfbfbf]">หยิบมาตรวจกี่ชิ้นต่อหนึ่งรอบ</p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <SoftLabel label="จำนวนตัวอย่างที่วัด (Sample Size)" required>
                  <NumberInput
                    className={SOFT_INPUT}
                    ariaLabel="จำนวนตัวอย่างที่วัด (Sample Size)"
                    min={1}
                    value={formData.sampleSize}
                    onChange={(v) => setFormData({ ...formData, sampleSize: v })}
                  />
                </SoftLabel>
              </div>
            </div>
          </div>

          {/* A5 — how the shell weight is obtained, and what the unit is called. */}
          {criteriaType === 'multi_point' && specPayload?.type === 'multi_point' && (
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <MultiPointSection
                  section="sampling"
                  payload={specPayload}
                  onChange={setSpecPayload}
                  tareSourceId={formData.tareSourceCriteriaId ?? null}
                  onTareSourceIdChange={(tid, tareUnit) =>
                    setFormData((prev) => ({
                      ...prev,
                      tareSourceCriteriaId: tid,
                      unit: tareUnit ?? prev.unit,
                    }))
                  }
                  currentId={id}
                />
              </div>
            </div>
          )}
          </FormSection>

          <FormSection step={4} title="เกณฑ์การพิจารณา" hint="ต่อหน่วย · รายรอบ · หลายขั้น · รายรุ่น · เมื่อไม่ผ่าน · ค่าที่คำนวณต่อ">

          {/* B1 — the spec for the chosen type. It kept the picker's card when
              the two were one section; now that the picker stands alone in
              step 2, these fields need a surface of their own rather than
              floating on the page. */}
          {!criteriaType ? (
            <div data-testid="type-fields-empty" className="px-6 py-5">
              <p className="rounded-[12px] bg-[#f9fafb] px-4 py-5 text-center text-[13px] text-[#9aa3ad]">
                เลือกประเภทเกณฑ์ก่อน — ช่องกรอกจะขึ้นตามประเภทที่เลือก
              </p>
            </div>
          ) : (
          <div
            data-testid="type-fields-card"
            className="px-6 py-5"
          >
            <div>
              {/* Numeric — the layout the Figma frame specifies */}
              {criteriaType === 'numeric' && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <SoftLabel label="Target (Specification)" required>
                    <input
                      type="number"
                      className={SOFT_INPUT}
                      placeholder="เช่น 300"
                      value={formData.specTarget ?? ''}
                      onChange={(e) => setFormData({ ...formData, specTarget: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </SoftLabel>
                  <SoftLabel label="±% Tolerance (Spec Range)">
                    <div className="relative">
                      <NumberInput
                        className={cn(SOFT_INPUT, 'pr-8')}
                        placeholder="0"
                        ariaLabel="±% Tolerance (Spec Range)"
                        min={0}
                        max={100}
                        value={formData.specTolerancePercent}
                        onChange={(v) => setFormData({ ...formData, specTolerancePercent: v })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                    </div>
                  </SoftLabel>
                  <SoftLabel label="Min Value">
                    <input
                      readOnly
                      aria-label="Min Value"
                      className={cn(SOFT_INPUT, 'cursor-not-allowed font-semibold')}
                      placeholder="—"
                      value={calculatedMinMax?.min ?? ''}
                    />
                  </SoftLabel>
                  <SoftLabel label="Max Value">
                    <input
                      readOnly
                      aria-label="Max Value"
                      className={cn(SOFT_INPUT, 'cursor-not-allowed font-semibold')}
                      placeholder="—"
                      value={calculatedMinMax?.max ?? ''}
                    />
                  </SoftLabel>
                </div>
              )}

              {/* Every other type keeps its existing editor, wrapped in the grid
                  those editors expect (they use sm:col-span-2 internally). */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {/* Pass / Fail */}
              {criteriaType === 'pass_fail' && specPayload?.type === 'pass_fail' && (
                <PassFailSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Visual */}
              {criteriaType === 'visual' && specPayload?.type === 'visual' && (
                <VisualSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Text */}
              {criteriaType === 'text' && specPayload?.type === 'text' && (
                <TextSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Multi-Point */}
              {criteriaType === 'multi_point' && specPayload?.type === 'multi_point' && (
                <MultiPointSection
                  section="per-unit"
                  payload={specPayload}
                  onChange={setSpecPayload}
                  tareSourceId={formData.tareSourceCriteriaId ?? null}
                  onTareSourceIdChange={(id, tareUnit) =>
                    setFormData((prev) => ({
                      ...prev,
                      tareSourceCriteriaId: id,
                      unit: tareUnit ?? prev.unit,
                    }))
                  }
                  currentId={id}
                />
              )}

              {/* Tare */}
              {criteriaType === 'tare' && specPayload?.type === 'tare' && (
                <TareSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Calibration */}
              {criteriaType === 'calibration' && specPayload?.type === 'calibration' && (
                <CalibrationSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Calculated */}
              {criteriaType === 'calculated' && specPayload?.type === 'calculated' && (
                <CalculatedSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Custom Multi-Field */}
              {criteriaType === 'custom_multi_field' && specPayload?.type === 'custom_multi_field' && (
                <CustomFieldsSection payload={specPayload} onChange={setSpecPayload} />
              )}
              </div>

              {/* Inset and evenly rounded, like the fields it summarises. It
                  was a footer flush to the card's edges with a rule along its
                  top, back when it had a card to be the footer of. */}
              {criteriaType === 'numeric' && calculatedMinMax && (
                <div className="mt-5 flex items-center gap-2 rounded-[12px] bg-[#f6fff1] px-4 py-3">
                  <p className="text-xs text-[#6b7280]">
                    ช่วงที่ยอมรับ : <span className="font-bold text-[#80b45f]">{calculatedMinMax.min}</span>
                    {' ≤ value ≤ '}
                    <span className="font-bold text-[#80b45f]">{calculatedMinMax.max}</span>
                    {' ('}
                    <span className="font-medium text-[#80b45f]">
                      {formData.specTarget} ± {formData.specTolerancePercent ?? 0}%
                    </span>
                    {')'}
                  </p>
                  <CheckRoundFill className="h-6 w-6 shrink-0 text-[#80b45f]" />
                </div>
              )}
            </div>
          </div>
          )}

          {/* ── เกณฑ์การตัดสินแบบหลายขั้น — Figma node 60:5641 ─────────
              Its own card, matching เอกสาร GMP / ประเภทเกณฑ์ / แผนการสุ่ม.

              The frame only draws the single-stage state, so the multi-stage
              editor below it keeps its existing layout: turning the switch on
              is what reveals it. */}
          <div
            data-testid="acceptance-card"
            className="px-6 py-5"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-black">เกณฑ์การตัดสินแบบหลายขั้น</h4>
                    <p className="text-xs text-[#bfbfbf]">
                      เกณฑ์การตัดสินแบบหลายขั้น (ตามหลัก GMP / USP &lt;711&gt;, &lt;905&gt;)
                    </p>
                  </div>

                  {/* The three numbers the operator is held to. Hidden once
                      multi-stage is on: each stage card then shows its own, and
                      a fourth copy in the header would just be one more number
                      to reconcile. */}
                  {!multiStageEnabled && acceptanceMath && (
                    <div className="flex flex-wrap items-center gap-4">
                      <AcceptanceStat
            surface="bg-[#f1f3f5]"
                        testId="acceptance-stat-tested"
                        icon={<User className="h-4 w-4" />}
                        label="ทดสอบ"
                        value={acceptanceMath.sampleSize}
                        unit="ชิ้น"
                        color="#5682e9"
                      />
                      <AcceptanceStat
            surface="bg-[#f1f3f5]"
                        testId="acceptance-stat-allowed"
                        icon={<ClockAlert className="h-4 w-4" />}
                        label="ยอมเสียได้"
                        value={acceptanceMath.allowedFail}
                        unit="ไม่เกินกี่ชิ้น"
                        color="#fc9709"
                      />
                      <AcceptanceStat
            surface="bg-[#f1f3f5]"
                        testId="acceptance-stat-must-pass"
                        icon={<ScanFace className="h-4 w-4" />}
                        label="ต้องผ่าน"
                        value={acceptanceMath.mustPass}
                        unit="ขั้นต่ำ"
                        color="#27ae60"
                      />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                  <HeaderSwitch
                    testId="multi-stage-switch"
                    checked={multiStageEnabled}
                    label="Multi-Stage"
                    onChange={() => {
                      if (multiStageEnabled) {
                        setMultiStageEnabled(false);
                      } else {
                        setMultiStageEnabled(true);
                        if (stages.length === 0) {
                          setStages([
                            { sampleSize: formData.sampleSize ?? 10, tolerancePercent: formData.tolerancePercent ?? 0, onFail: 'next_stage' },
                            { sampleSize: 20, tolerancePercent: 10, onFail: 'reject_batch' },
                          ]);
                        }
                      }
                    }}
                  />
                  <span
                    data-testid="stage-count-pill"
                    className="rounded-full bg-white px-3 py-1 text-xs text-black shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  >
                    {stageCount} Stage{stageCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-5">
                {multiStageEnabled && (
                  <>
                    <div className="mb-6 flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#ffdeb0] bg-[#fff7ed] p-[14px]">
                      <Info className="h-[18px] w-[18px] shrink-0 text-[#c2410c]" />
                      <p className="text-xs font-medium text-[#c2410c]">
                        หากการทดสอบครั้งแรก (Stage 1) ไม่ผ่าน ให้สุ่มตัวอย่างเพิ่มเพื่อทดสอบครั้งที่ 2
                        โดยใช้เกณฑ์ที่เข้มขึ้น (รวมจำนวนทั้งหมด) ก่อนตัดสิน Reject batch
                      </p>
                    </div>

                    {/* Pharmacopoeia quick-load. Styled like the other choice
                        rows in this card — the outlined 56px control — and it
                        marks which plan is currently loaded, so it is clear
                        whether the stages below came from a standard or were
                        typed by hand. */}
                    <div className="mb-6 flex flex-col gap-4">
                      <p className="text-[13px] font-semibold text-slate-700">แผนมาตรฐานตามตำรายา</p>
                      <div className="flex flex-col gap-6 sm:flex-row">
                        <PresetButton
                          testId="preset-usp-711"
                          active={matchesPlan(stages, USP_DISSOLUTION_PLAN)}
                          onClick={loadUSPDissolution}
                          title="USP <711> Dissolution"
                          plan="6 → 6 → 12"
                        />
                        <PresetButton
                          testId="preset-usp-905"
                          active={matchesPlan(stages, USP_UNIFORMITY_PLAN)}
                          onClick={loadUSPUniformity}
                          title="USP <905> Uniformity"
                          plan="10 → 20"
                        />
                      </div>
                    </div>

                    {/*
                      Stepper. The stages are a sequence where each one only
                      happens because the one before it failed, and a plain
                      stack of cards does not say that. The rail carries the
                      order; the segment between two nodes carries the
                      condition.
                    */}
                    <ol data-testid="stage-stepper" className="flex flex-col">
                      {stages.map((stage, idx) => {
                        const last = idx === stages.length - 1;
                        const showRail = !last || stages.length < 5;
                        return (
                          <li key={idx} className="flex gap-4">
                            <div className="flex w-8 shrink-0 flex-col items-center">
                              <StepNode onFail={stage.onFail} />
                              {showRail && (
                                // The segment carries this stage's outcome:
                                // solid where the flow continues, dashed where
                                // it stops at reject or deviation.
                                <span
                                  className={cn(
                                    'w-0 flex-1',
                                    stage.onFail === 'next_stage'
                                      ? 'border-l-[1.5px] border-solid'
                                      : 'border-l-[3px] border-dashed',
                                  )}
                                  style={{
                                    borderColor:
                                      stage.onFail === 'next_stage'
                                        ? `${ON_FAIL_META[stage.onFail].color}66`
                                        : '#e1e4e8',
                                  }}
                                />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 pb-6">
                              {/* The step heading lives on the rail, not inside
                                  the card: the node number and a "Stage N"
                                  title in the card said the same thing twice. */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <h5 className="text-sm font-semibold leading-8 text-black">
                                    Stage {idx + 1}
                                  </h5>
                                  <p className="mt-1 text-[11px] text-[#bfbfbf]">
                                    สุ่ม {stage.sampleSize} units · รวมทดสอบทั้งหมด {cumulative[idx] ?? 0} units
                                  </p>
                                </div>
                                {/* Stage 1 always runs, so only later stages can go. */}
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => removeStage(idx)}
                                    aria-label={`ลบ Stage ${idx + 1}`}
                                    data-testid={`remove-stage-${idx}`}
                                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d9d9d9] text-white transition-colors hover:bg-[#c0362c]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="mt-4">
                                <StageCard
                                  idx={idx}
                                  isLast={last}
                                  stage={stage}
                                  onChange={(patch) => updateStage(idx, patch)}
                                />
                              </div>

                            </div>
                          </li>
                        );
                      })}

                      {/* Not in the frame, but without it there is no way to
                          add a retest stage at all. */}
                      {stages.length < 5 && (
                        <li className="flex gap-4">
                          <div className="flex w-8 shrink-0 justify-center">
                            <StepNode placeholder />
                          </div>
                          <button
                            type="button"
                            onClick={addStage}
                            data-testid="add-stage"
                            className={cn(DASH, 'flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] border-[#e1e4e8] text-[13px] text-[#bfbfbf] transition hover:bg-[#f8f9fa]')}
                          >
                            <Plus className="h-4 w-4" />
                            เพิ่ม Stage {stages.length + 1} (Retest)
                          </button>
                        </li>
                      )}
                    </ol>
                  </>
                )}

                {/* The stats moved into the header, so this is just the pair
                    of inputs that drives them. */}
                {/* Sample Size is asked once, in card A — this card decides
                    what counts as a pass, not how much is taken. */}
                {/* One column: Sample Size used to sit beside this and now
                    lives in step A, which left the survivor stranded at half
                    width while everything above it ran the full block. */}
                {!multiStageEnabled && (
                  <div className="grid grid-cols-1 gap-6">
                    <SoftLabel label="เกณฑ์การยอมรับ">
                      <div className="relative">
                        <NumberInput
                          className={cn(SOFT_INPUT, 'pr-8')}
                          ariaLabel="เกณฑ์การยอมรับ"
                          min={0}
                          max={100}
                          value={formData.tolerancePercent}
                          onChange={(v) => setFormData({ ...formData, tolerancePercent: v })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                      </div>
                    </SoftLabel>
                  </div>
                )}
            </div>
          </div>

          {/* B4 — รายรุ่น. Sits after the round-level acceptance card
              because it consumes its result: every unit is judged first, then
              this rule turns the round into one verdict for the batch. */}
          {criteriaType === 'multi_point' && specPayload?.type === 'multi_point' && (
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <MultiPointSection
                  section="batch"
                  payload={specPayload}
                  onChange={setSpecPayload}
                  tareSourceId={formData.tareSourceCriteriaId ?? null}
                  onTareSourceIdChange={(tid, tareUnit) =>
                    setFormData((prev) => ({
                      ...prev,
                      tareSourceCriteriaId: tid,
                      unit: tareUnit ?? prev.unit,
                    }))
                  }
                  currentId={id}
                />
              </div>
            </div>
          )}

          {/* B5 — เมื่อไม่ผ่าน. The way out of a failing result: whether the
              criterion is critical, and how many retests the plan allows. It
              belongs with the judgement, not with the on/off switch it used
              to share a card with. */}
          {/* Same shape as ตรวจสอบเมื่อ and สถานะการใช้งาน: the toggle is
              the card, so the heading sits on the page rather than inside a
              second panel drawn around it. */}
          <div data-testid="fail-route-card" className="flex flex-col gap-2.5 px-6 py-5">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-black">เมื่อไม่ผ่าน</h4>
              <p className="text-xs text-[#bfbfbf]">ผลตกแล้วไปทางไหนต่อ</p>
            </div>
            <TriggerCard
                testId="setting-critical"
                icon={<Shield className="h-4 w-4" />}
                title="Critical Test"
                desc="ถ้า fail จะ block batch ทันที"
                info="เกณฑ์วิกฤต — ถ้าผลไม่ผ่านจะหยุด batch ทันที ไม่มีสิทธิ์ทดสอบซ้ำ และ Retest สูงสุดจะถูกบังคับเป็น 0"
                onColor="#c0362c"
                autoFilled={isAutoFilled('isCritical')}
                on={!!formData.isCritical}
                alwaysExpanded
                onToggle={() => setFormData({ ...formData, isCritical: !formData.isCritical })}
              >
                {formData.isCritical ? (
                  // Forced, so it is stated — a disabled input nobody can
                  // act on only invites clicking.
                  <div className="flex items-start gap-2 text-[#c0362c]">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs font-medium leading-relaxed">
                      Retest = 0 — fail รอบแรกสร้าง Deviation ทันที
                      <br />
                      <span className="font-normal text-[#9aa3ad]">
                        แก้ค่านี้ไม่ได้เมื่อเปิด Critical
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3" data-testid="retest-choices">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[#bfbfbf]">
                        จำนวน Retest สูงสุด <span className="text-[#e32727]">*</span>
                      </span>
                      {retestMissing && (
                        <span
                          data-testid="retest-unset-badge"
                          className="rounded-full bg-[#fdf3e7] px-2 py-0.5 text-[10px] font-medium text-[#c2410c]"
                        >
                          ยังไม่ได้เลือก
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3].map((n) => {
                        const active = retestChosen && !retestCustom && formData.maxRetestRounds === n;
                        return (
                          <button
                            type="button"
                            key={n}
                            data-testid={`retest-${n}`}
                            aria-pressed={active}
                            aria-label={`Retest ${n} รอบ`}
                            onClick={() => chooseRetest(n)}
                            className={cn(
                              'h-10 w-12 rounded-[12px] border text-sm font-semibold transition-colors',
                              active
                                ? 'border-[#2f6fd0] bg-[#2f6fd0] text-white'
                                : 'border-[#e1e4e8] bg-white text-slate-700 hover:border-[#9db9e8]',
                              retestMissingShown && retestMissing && 'border-[#f0b4ae]',
                            )}
                          >
                            {n}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        data-testid="retest-custom"
                        aria-pressed={retestCustom}
                        onClick={() => { setRetestCustom(true); setRetestChosen(false); }}
                        className={cn(
                          'h-10 rounded-[12px] border px-3 text-sm font-medium transition-colors',
                          retestCustom
                            ? 'border-[#2f6fd0] bg-[#eef3fc] text-[#1f4e9c]'
                            : 'border-[#e1e4e8] bg-white text-slate-700 hover:border-[#9db9e8]',
                        )}
                      >
                        กำหนดเอง
                      </button>
                      {retestCustom && (
                        <NumberInput
                          className={cn(SOFT_INPUT, 'w-24')}
                          ariaLabel="จำนวน Retest กำหนดเอง"
                          min={1}
                          max={5}
                          value={retestChosen ? (formData.maxRetestRounds ?? 0) : null}
                          onChange={(v) =>
                            v == null
                              ? setRetestChosen(false)
                              : chooseRetest(v, true)
                          }
                        />
                      )}
                    </div>

                    {/* Reads the setting back as a sentence — the last
                        chance to notice a number that says the wrong thing. */}
                    {retestMissingShown && retestMissing ? (
                      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#c2410c]">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>ต้องเลือกจำนวน Retest ก่อนบันทึก — ไม่มีค่าเริ่มต้นให้</span>
                      </p>
                    ) : retestChosen ? (
                      <p
                        data-testid="retest-readback"
                        className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#1a8a4a]"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          ไม่ผ่านรอบแรก → ทดสอบซ้ำได้อีก {formData.maxRetestRounds} ครั้ง ·
                          ถ้ายังไม่ผ่าน → สร้าง Deviation
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#bfbfbf]">
                        เลือก 1 ปุ่มเพื่อยืนยันจำนวนรอบ — ถ้าไม่ให้ทดสอบซ้ำเลย ให้เปิด Critical แทน
                      </p>
                    )}
                  </div>
                )}
            </TriggerCard>
            {/* The standard behind the retest budget, as a caption on the
                page — it was a card footer, which needed a card to be a
                footer of. */}
            <p className="px-1 text-xs text-[#bfbfbf]">
              ตามมาตรฐาน FDA OOS 2006: Justified retest (พบสาเหตุ) นับเป็นรอบเพิ่ม / Unjustified
              retest (ไม่มีเหตุผลชัดเจน) จะสร้าง Deviation ทันที
            </p>
          </div>

          {/* ── การคำนวณที่ได้จากผล — Figma node 71:7883 ───────────────
              Its own card. Each formula is a sub-card of soft fields, so a
              batch with several derived values does not read as one long
              undifferentiated form. */}
          {!derivedCalcUnlocked ? (
            <div
              data-testid="derived-calc-locked"
              className="flex flex-col gap-3 px-6 py-5"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f3f5] text-[#9aa3ad]"
                >
                  <Lock className="h-4 w-4" />
                </span>
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-semibold text-[#6b7280]">การคำนวณที่ได้จากผล</h4>
                  {/* Says which switch brings it back — a card that just
                      vanishes leaves the user with nothing to act on. */}
                  <p className="text-xs text-[#bfbfbf]">
                    ใช้ได้เมื่อเปิด &quot;ครั้งเดียวต่อ batch&quot; หรือ &quot;ที่ milestone&quot; ในหัวข้อ ตรวจสอบเมื่อ
                    — สูตรอย่าง Yield สรุปได้ตอนจบรุ่นเท่านั้น
                  </p>
                </div>
              </div>
              {/* Formulas already entered stay in the payload, so they are
                  declared here rather than left saved but invisible. */}
              {sharedExtras.derivedCalcs.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    ยังมี {sharedExtras.derivedCalcs.length} สูตรที่บันทึกไว้อยู่ —
                    เปิด trigger ข้างต้นเพื่อกลับไปแก้ไขหรือลบ
                  </span>
                </div>
              )}
            </div>
          ) : (
          <div
            data-testid="derived-calc-card"
            className="px-6 py-5"
          >
            <div className="flex flex-col gap-4">
              {/* Action sits opposite the title, like the switch on the
                  acceptance card and the counter on the triggers list. */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-black">
                    การคำนวณที่ได้จากผล <span className="text-[#e32727]">*</span>
                  </h4>
                  <p className="text-xs text-[#bfbfbf]">
                    คำนวณข้ามขั้นตอน เช่น Yield = output / input, %LOD = (wet − dry) / wet × 100
                  </p>
                </div>
                {/* Filled rather than outlined: it is the only action in this
                    card, and on a #fbfbfb header a white pill barely reads as a
                    button at all. #2f6fd0 keeps white text above 4.5:1. */}
                <button
                  type="button"
                  onClick={addDerivedCalc}
                  data-testid="add-derived-calc"
                  className="flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#2f6fd0] py-2 pl-2 pr-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#2a61b8]"
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25"
                  >
                    <Plus className="h-3 w-3" />
                  </span>
                  เพิ่มสูตร
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 p-6">
              {sharedExtras.derivedCalcs.length === 0 ? (
                <div className={cn(DASH, 'rounded-[14px] border-[#e1e4e8] px-4 py-8 text-center text-[13px] text-[#bfbfbf]')}>
                  ยังไม่มีสูตรคำนวณ — กด &quot;เพิ่มสูตร&quot; เพื่อเริ่ม
                </div>
              ) : (
                sharedExtras.derivedCalcs.map((dc, idx) => (
                  <DerivedCalcCard
                    key={dc.id}
                    idx={idx}
                    calc={dc}
                    onChange={(patch) => updateDerivedCalc(dc.id, patch)}
                    onRemove={() => removeDerivedCalc(dc.id)}
                  />
                ))
              )}
            </div>
          </div>

          )}
          </FormSection>

          <FormSection step={5} title="สถานะการใช้งาน" hint="Active แยกจาก Critical และ Retest เพราะเป็นสถานะของเกณฑ์ ไม่ใช่วิธีตัดสินผล">

          {/* A TriggerCard is already a card. Wrapping one in a second card
              drew a white panel inside a white panel with nothing between
              them, so this follows ตรวจสอบเมื่อ: a heading on the page
              surface, and the toggle as the only card. */}
          <div data-testid="settings-card" className="flex flex-col gap-2.5 px-6 py-5">
            <TriggerCard
              testId="setting-active"
              icon={<Power className="h-4 w-4" />}
              title="Active"
              desc="เปิดใช้กับ batch ใหม่"
              info="ปิดไว้ = เกณฑ์นี้จะไม่ถูกนำไปใช้กับ batch ที่เปิดใหม่ แต่ข้อมูลเดิมที่บันทึกไว้ยังอยู่ครบ"
              on={formData.isActive !== false}
              onToggle={() => setFormData({ ...formData, isActive: !(formData.isActive !== false) })}
            />
          </div>
          </FormSection>

        </div>

        {/* ─── Live Preview column (1/3) ────────────────────────── */}
        <aside className="xl:col-span-1 xl:h-full xl:min-h-0">
          {/*
            The sticky column scrolls on its own.

            It was only sticky before, so a preview taller than the viewport
            could not be read without scrolling the whole page to the bottom
            first — and the page stops there, which meant the tail of a
            twenty-row recording table was unreachable. Giving the column its
            own height and overflow lets the pointer scroll it in place.

            `overscroll-contain` keeps that scroll from continuing into the
            page once the column hits its end.
          */}
          <div
            data-testid="preview-column"
            className={cn(
              'space-y-4',
              'xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-1',
              // The page root is h-[calc(100vh-3rem)] and this sticks 1rem
              // below its top edge, so the space actually left for the column
              // is 3rem + 1rem less than the viewport. Asking for
              // 100vh-2rem made it taller than the room it had, and the
              // bottom of the column — the CREATE button — sat below the fold
              // even after scrolling the column to its end.
              // Room for the last card's shadow, which a flush edge clips.
              'xl:pb-2',
            )}
          >
            <LivePreviewPanel
              formData={formData}
              criteriaType={criteriaType}
              calculatedMinMax={calculatedMinMax}
              acceptanceMath={acceptanceMath}
              multiStageEnabled={multiStageEnabled}
              stages={stages}
              specPayload={specPayload}
              stage={sharedExtras.stage}
            />

            {/* Last card in the column, so it sticks along with the preview. */}
            <div
              data-testid="form-actions"
              className="flex flex-col gap-3 rounded-[24px] bg-white p-4 shadow-[0_4px_4px_rgba(0,0,0,0.1)]"
            >
              <div className="truncate text-xs text-slate-500">
                {formData.name ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                    <span className="truncate">
                      พร้อมบันทึก:{' '}
                      <span className="font-semibold text-slate-700">
                        {formData.code || '(ยังไม่มี Code)'}
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-600">⚠ กรุณาเลือก Test Name ก่อน</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/master-data/ipc-criteria')}
                  className="flex-1 rounded-[10px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !formData.name || !formData.code}
                  className="flex-1 rounded-[10px] bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'SAVING...' : mode === 'edit' ? 'UPDATE' : 'CREATE'}
                </button>
              </div>
            </div>

          </div>
        </aside>
      </div>

      <ConfirmDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onCancel={handleCancel}
        confirmText="เปลี่ยนและล้างข้อมูล"
        cancelText="ยกเลิก"
        testIdPrefix={dialogState.testIdPrefix}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────


function AutoBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium">
      <Sparkles className="w-2.5 h-2.5" /> Auto
    </span>
  );
}



// ── Trigger card (collapsible toggle + nested config) ──────────────
interface TriggerCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  /** Shown in the tooltip — what this trigger actually does on the line. */
  info: string;
  on: boolean;
  onToggle: () => void;
  testId: string;
  /** Track colour when on. Red for settings that make a failure stop the batch. */
  onColor?: string;
  /** Marks a value the test catalog filled in, as the old toggle card did. */
  autoFilled?: boolean;
  /** This trigger suits the chosen Use Context. */
  recommended?: boolean;
  /**
   * Keep the body visible while the switch is off. Critical needs it: its body
   * is the retest budget, which only applies *because* Critical is off.
   */
  alwaysExpanded?: boolean;
  children?: React.ReactNode;
}

/**
 * Hover / focus tooltip on an info icon. Written by hand rather than pulled in
 * as a dependency — it is one bubble, and `group-focus-within` gives keyboard
 * users the same thing hover gives mouse users.
 */
function InfoTip({ text, testId }: { text: string; testId: string }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={text}
        data-testid={testId}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[#bfbfbf] transition-colors hover:text-[#5682e9] focus-visible:text-[#5682e9]"
      >
        <CircleAlert className="h-5 w-5" />
      </button>
      <span
        role="tooltip"
        data-testid={`${testId}-bubble`}
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-[12px] bg-[#1a1d21] px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function TriggerCard({ icon, title, desc, info, on, onToggle, testId, onColor = '#27ae60', autoFilled, recommended, alwaysExpanded, children }: TriggerCardProps) {
  return (
    <div
      data-testid={`${testId}-card`}
      className="rounded-[14px] border border-[#e8ebf0] bg-white"
    >
      {/* The row is not one big button: the info tooltip is itself a control,
          and a button inside a button is invalid. The switch does the toggling. */}
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5682e9] text-white"
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-black">{title}</p>
              <InfoTip text={info} testId={`${testId}-info`} />
              {recommended && (
                <span
                  data-testid={`${testId}-recommended`}
                  className="shrink-0 rounded-full bg-[#eef3fc] px-2 py-0.5 text-[10px] font-medium text-[#2f6fd0]"
                >
                  แนะนำ
                </span>
              )}
              {autoFilled && <AutoBadge />}
            </div>
            <p className="truncate text-[11px] text-[#bfbfbf]">{desc}</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={title}
          data-testid={`${testId}-switch`}
          onClick={onToggle}
          className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', !on && 'bg-[#ebebec]')}
          style={on ? { backgroundColor: onColor } : undefined}
        >
          {/* 48px track, 20px thumb, 2px inset — so the travel is 24px and the
              gap is even on both ends. */}
          <span
            className={cn(
              'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] transition-transform',
              on ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      {(on || alwaysExpanded) && children && (
        <div className="border-t-[1.5px] border-[#f1f3f5] px-6 py-4">{children}</div>
      )}
    </div>
  );
}

// ── Derived calc card ──────────────────────────────────────────────
interface DerivedCalcCardProps {
  /** Position in the list — used only to keep field labels unique. */
  idx: number;
  calc: DerivedCalc;
  onChange: (patch: Partial<DerivedCalc>) => void;
  onRemove: () => void;
}

function DerivedCalcCard({ idx, calc, onChange, onRemove }: DerivedCalcCardProps) {
  return (
    <div
      data-testid={`derived-calc-${idx}`}
      className="rounded-[14px] border-[1.5px] border-[#f1f3f5] bg-white p-6"
    >
      {/* Numbered heading with the remove control opposite it — the same
          arrangement the stage steps use. */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <h5 className="text-sm font-semibold text-black">สูตรที่ {idx + 1}</h5>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`ลบสูตรที่ ${idx + 1}`}
          data-testid={`remove-derived-calc-${idx}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d9d9d9] text-white transition-colors hover:bg-[#c0362c]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SoftLabel label="ชื่อสูตร">
          <input
            className={SOFT_INPUT}
            aria-label={`ชื่อสูตร ${idx + 1}`}
            placeholder="เช่น Yield"
            value={calc.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </SoftLabel>
        <SoftLabel label="Formula">
          <input
            className={cn(SOFT_INPUT, 'font-mono')}
            aria-label={`Formula ${idx + 1}`}
            placeholder="(output - waste) / input * 100"
            value={calc.formula}
            onChange={(e) => onChange({ formula: e.target.value })}
          />
        </SoftLabel>

        <SoftLabel label="Sources">
          <input
            className={SOFT_INPUT}
            aria-label={`Sources ${idx + 1}`}
            placeholder="IPC-WV-001, IPC-LOD-001"
            value={calc.sources}
            onChange={(e) => onChange({ sources: e.target.value })}
          />
        </SoftLabel>
        <SoftLabel label="Result Unit">
          <input
            className={SOFT_INPUT}
            aria-label={`Result Unit ${idx + 1}`}
            placeholder="%"
            value={calc.resultUnit}
            onChange={(e) => onChange({ resultUnit: e.target.value })}
          />
        </SoftLabel>

        <SoftLabel label="Trigger When">
          <input
            className={SOFT_INPUT}
            aria-label={`Trigger When ${idx + 1}`}
            placeholder="ปิด batch / หลังสูตร X"
            value={calc.triggerWhen}
            onChange={(e) => onChange({ triggerWhen: e.target.value })}
          />
        </SoftLabel>
        <SoftLabel label="On Fail">
          <select
            className={cn(SOFT_INPUT, 'appearance-none pr-9')}
            aria-label={`On Fail ${idx + 1}`}
            value={calc.onFail}
            onChange={(e) => onChange({ onFail: e.target.value as DerivedCalc['onFail'] })}
          >
            <option value="reject">Reject Batch</option>
            <option value="deviation">Create Deviation</option>
            <option value="note">Note only</option>
          </select>
        </SoftLabel>

        <SoftLabel label="Acceptance Min">
          <input
            className={SOFT_INPUT}
            aria-label={`Acceptance Min ${idx + 1}`}
            placeholder="90"
            value={calc.acceptanceMin}
            onChange={(e) => onChange({ acceptanceMin: e.target.value })}
          />
        </SoftLabel>
        <SoftLabel label="Acceptance Max">
          <input
            className={SOFT_INPUT}
            aria-label={`Acceptance Max ${idx + 1}`}
            placeholder="105"
            value={calc.acceptanceMax}
            onChange={(e) => onChange({ acceptanceMax: e.target.value })}
          />
        </SoftLabel>

        <div className="sm:col-span-2">
          <SoftLabel label="Note">
            <input
              className={SOFT_INPUT}
              aria-label={`Note ${idx + 1}`}
              placeholder="หมายเหตุ"
              value={calc.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </SoftLabel>
        </div>
      </div>
    </div>
  );
}

// ── Multi-Point section ────────────────────────────────────────────
interface TareCriteriaOption {
  id: number;
  code: string;
  name: string;
  /** Read back once linked, so the choice can be checked without leaving. */
  unit: string;
  acceptanceMin: string;
  acceptanceMax: string;
  expireAfter: string;
  storeAs: string;
}

function MultiPointSection({
  payload,
  onChange,
  tareSourceId,
  onTareSourceIdChange,
  currentId,
  section,
}: {
  payload: MultiPointPayload;
  onChange: (p: MultiPointPayload) => void;
  tareSourceId: number | null;
  /**
   * Reports the linked tare and the unit it is recorded in.
   *
   * Gross, tare and net are one subtraction, so they are one unit — a tare
   * kept in mg cannot be taken off a gross weighed in g. The criterion
   * therefore follows the tare it is linked to rather than keeping whatever
   * unit was chosen before the link was made, which is how the preview came
   * to report g against a tare of mg.
   */
  onTareSourceIdChange: (id: number | null, unit?: string | null) => void;
  currentId?: number;
  /**
   * Which half of the criterion this instance edits.
   *
   * The three parts answer different questions and sit in different places in
   * the form, so the fields are split between them rather than duplicated:
   * 'sampling' draws the tare method and what the unit is called, 'per-unit'
   * the limit one piece must meet, and 'batch' the rule that turns every
   * piece into one verdict for the run. The last two are separated because
   * the round-level acceptance card belongs between them.
   */
  section: 'sampling' | 'per-unit' | 'batch';
}) {
  // Fetch list of tare criteria for cross-reference dropdown
  const { data: tareList = [], refetch } = useQuery<TareCriteriaOption[]>({
    queryKey: ['ipc-criteria-tare-list'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const data = await res.json();
      if (!data.success) return [];
      const all: {
        id: number; code: string; name: string; criteriaType: string;
        unit?: string | null; specification?: unknown;
      }[] = data.data || [];
      return all
        .filter((c) => c.criteriaType === 'tare' && c.id !== currentId)
        .map((c) => {
          // The tare's own numbers live in its spec envelope; parse it here so
          // linking one can show what it actually is.
          const spec = parseSpecPayload('tare', c.specification);
          const t = spec?.type === 'tare' ? spec : null;
          return {
            id: c.id,
            code: c.code,
            name: c.name,
            unit: t?.referenceUnit || c.unit || '',
            acceptanceMin: t?.acceptanceMin ?? '',
            acceptanceMax: t?.acceptanceMax ?? '',
            expireAfter: t?.expireAfter ?? '',
            storeAs: t?.storeAs ?? '',
          };
        });
    },
    staleTime: 30_000,
  });

  /**
   * Inline creation of a tare criterion.
   *
   * A tare source is another ipc_criteria row, so on a fresh database the
   * dropdown is empty and the only way forward was to abandon this half-filled
   * form, create the tare elsewhere and start again. The four fields a tare
   * needs fit here, so it is made here.
   */
  const [newTareOpen, setNewTareOpen] = React.useState(false);
  /**
   * The same fields the full form writes for a tare criterion — the row itself
   * (code, name, unit) plus every field of `TarePayload`, so a tare made here
   * is indistinguishable from one made the long way round.
   */
  const [newTare, setNewTare] = React.useState({
    code: '',
    name: '',
    unit: 'g',
    storeAs: '',
    expireAfter: 'batch' as TarePayload['expireAfter'],
    min: '',
    max: '',
  });
  const [newTareError, setNewTareError] = React.useState('');

  const linkedTare = tareList.find((t) => t.id === tareSourceId) ?? null;

  /** Opens the panel with a generated code, as the catalogue tests get one. */
  const openNewTare = (seedCode?: string) => {
    setNewTare((prev) => ({
      ...prev,
      code: seedCode?.trim() ? seedCode.trim().toUpperCase() : prev.code || suggestCodeForCustom('TARE'),
    }));
    setNewTareOpen(true);
  };

  const createTare = useMutation({
    mutationFn: async () => {
      const spec: TarePayload = {
        type: 'tare',
        referenceLabel: newTare.name.trim(),
        referenceUnit: newTare.unit.trim(),
        // Falls back to the code so the symbol is never empty — a calculated
        // formula referencing this tare needs something to name it by.
        storeAs: newTare.storeAs.trim() || newTare.code.trim(),
        acceptanceMin: newTare.min.trim(),
        acceptanceMax: newTare.max.trim(),
        expireAfter: newTare.expireAfter,
      };
      const res = await fetch('/api/master-data/ipc-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newTare.code.trim(),
          name: newTare.name.trim(),
          criteriaType: 'tare',
          unit: newTare.unit.trim() || null,
          sampleSize: 10,
          isActive: true,
          isCritical: false,
          specification: serializeSpecification(spec, defaultSharedExtras(), 'tare'),
        }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'สร้าง Tare ไม่สำเร็จ');
      return body.data as { id: number };
    },
    onSuccess: async (created) => {
      // Link it straight away — the user asked for this tare in order to use
      // it, so making them pick it from the list afterwards is a wasted step.
      await refetch();
      onTareSourceIdChange(created.id, newTare.unit || null);
      onChange({ ...payload, tareSourceCode: newTare.code.trim() });
      setNewTareOpen(false);
      setNewTare({ code: '', name: '', unit: 'g', storeAs: '', expireAfter: 'batch', min: '', max: '' });
      setNewTareError('');
    },
    onError: (e: Error) => setNewTareError(e.message),
  });

  const submitNewTare = () => {
    if (!newTare.code.trim() || !newTare.name.trim()) {
      setNewTareError('ต้องกรอก Code และชื่อ');
      return;
    }
    setNewTareError('');
    createTare.mutate();
  };

  // Auto-compute aggregateLimit for mean/min_max (target ± tolerance%)
  React.useEffect(() => {
    if (payload.aggregateRule !== 'mean' && payload.aggregateRule !== 'min_max') return;
    const tgt = Number(payload.perPointTarget);
    const tol = Number(payload.perPointTolerance);
    if (!Number.isFinite(tgt) || !Number.isFinite(tol) || tgt === 0) return;
    const min = tgt * (1 - tol / 100);
    const max = tgt * (1 + tol / 100);
    const next = `${min.toFixed(4)}-${max.toFixed(4)}`;
    if (next !== payload.aggregateLimit) onChange({ ...payload, aggregateLimit: next });
  }, [payload, onChange]);

  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      {/* No heading of its own: every group below already names itself, and
          the per-unit one carried the identical title twice over. */}
      {section === 'sampling' ? (
        <>
        <div className="flex flex-col gap-4 rounded-[16px] bg-[#f9fafb] p-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6b7280]" />
            <h4 className="text-sm font-semibold text-black">วิธีบันทึกค่า Tare</h4>
            <span className="text-[11px] text-slate-400">Tare Recording Method</span>
          </div>

          {/* Linking a tare answers the whole question: the shell weight comes
              from that criterion, so there is nothing left to choose about how
              to weigh it here. The picker therefore comes first, and the manual
              settings below only appear when nothing is linked. */}
          <div className="flex flex-col gap-2 rounded-[12px] bg-[#f1f3f5] p-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-black">
                ใช้ค่า Tare จากเกณฑ์อื่น (Tare Source)
              </span>
              <span className="text-[11px] text-slate-400">ไม่บังคับ</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="ml-auto text-[11px] text-[#3559b0] underline hover:text-[#2a4a95]"
              >
                ⟳ refresh
              </button>
            </div>
            <SearchableSelect
              triggerClassName={SOFT_SELECT_ON_GREY}
              testId="tare-source"
              value={tareSourceId ? String(tareSourceId) : ''}
              onChange={(v) => {
                if (!v) {
                  onTareSourceIdChange(null);
                  onChange({ ...payload, tareSourceCode: '' });
                } else {
                  const opt = tareList.find((t) => String(t.id) === v);
                  onTareSourceIdChange(Number(v), opt?.unit ?? null);
                  onChange({ ...payload, tareSourceCode: opt?.code ?? '' });
                }
              }}
              options={tareList.map((t) => ({ value: String(t.id), label: `${t.code} — ${t.name}` }))}
              placeholder="— ไม่ใช้ tare —"
              onAddNew={(text) => openNewTare(text)}
              addNewLabel="＋ สร้าง Tare criteria ใหม่"
            />

            {/* Empty list is not a dead end — say so, and offer the way out. */}
            {tareList.length === 0 && !newTareOpen && (
              <div
                data-testid="tare-empty"
                className="mt-2 flex flex-col gap-2 rounded-[12px] bg-[#f6f7f9] p-3"
              >
                <p className="text-[11px] leading-relaxed text-cyan-800">
                  ยังไม่มี Tare criteria ในระบบ — <b>ไม่เลือกก็ได้</b> หัวข้อนี้จะให้ชั่งเปลือกเปล่าเองตามวิธีที่ตั้งไว้ด้านบน
                  <br />
                  เลือกสร้างไว้ก็ต่อเมื่ออยากให้ค่า Tare ใช้ร่วมกันหลายหัวข้อ หรือชั่งไว้ล่วงหน้าครั้งเดียวต่อรุ่น
                </p>
                <button
                  type="button"
                  data-testid="tare-create-open"
                  onClick={() => openNewTare()}
                  className="flex w-fit items-center gap-2 rounded-full bg-cyan-700 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-cyan-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  สร้าง Tare criteria ใหม่
                </button>
              </div>
            )}

            {newTareOpen && (
              <div
                data-testid="tare-create-panel"
                className="mt-2 flex flex-col gap-3 rounded-[12px] bg-[#f6f7f9] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-[13px] font-semibold text-cyan-800">สร้าง Tare criteria ใหม่</h5>
                  <button
                    type="button"
                    aria-label="ปิด"
                    onClick={() => { setNewTareOpen(false); setNewTareError(''); }}
                    className="text-slate-400 transition hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_LABEL}>
                      Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="เช่น IPC-TARE-101"
                      data-testid="tare-new-code"
                      value={newTare.code}
                      onChange={(e) => setNewTare({ ...newTare, code: e.target.value })}
                    />
                    <p className={FIELD_HELPER}>ระบบสร้างให้แล้ว แก้ได้</p>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>
                      ชื่อ / Reference Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="เช่น น้ำหนักแคปซูลเปล่า เบอร์ 1"
                      data-testid="tare-new-name"
                      value={newTare.name}
                      onChange={(e) => setNewTare({ ...newTare, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>หน่วย (Reference Unit)</label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="g"
                      data-testid="tare-new-unit"
                      value={newTare.unit}
                      onChange={(e) => setNewTare({ ...newTare, unit: e.target.value })}
                    />
                  </div>
                  <div>
                    {/* "Store As" names a thing that appears nowhere else on this
                        screen, so the label on its own cannot explain it. */}
                    <label className={cn(FIELD_LABEL, 'flex items-center gap-1')}>
                      Store As (symbol)
                      <InfoTip
                        text="ชื่อย่อที่ใช้เรียกค่า Tare นี้ในสูตรคำนวณ — ตั้งเป็น tare_empty_cap แล้วในการ์ด การคำนวณที่ได้จากผล เขียนสูตรได้เลยว่า (gross − tare_empty_cap) โดยไม่ต้องพิมพ์ Code ยาว ๆ · ใช้ตัวอักษรอังกฤษพิมพ์เล็กกับ _ เท่านั้น ถ้าเว้นว่าง ระบบจะใช้ Code ของเกณฑ์นี้แทน"
                        testId="tare-new-store-as-info"
                      />
                    </label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="tare_empty_cap"
                      data-testid="tare-new-store-as"
                      value={newTare.storeAs}
                      onChange={(e) => setNewTare({ ...newTare, storeAs: e.target.value })}
                    />
                    <p className={FIELD_HELPER}>ชื่อย่อสำหรับอ้างอิงในสูตร calculated — เว้นว่างได้ ระบบใช้ Code แทน</p>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Expire After</label>
                    <select
                      className={FIELD_INPUT}
                      aria-label="Expire After"
                      data-testid="tare-new-expire"
                      value={newTare.expireAfter}
                      onChange={(e) =>
                        setNewTare({ ...newTare, expireAfter: e.target.value as TarePayload['expireAfter'] })
                      }
                    >
                      <option value="batch">หมดอายุเมื่อจบ batch</option>
                      <option value="shift">หมดอายุเมื่อจบกะ</option>
                      <option value="permanent">ใช้ได้ตลอด (permanent)</option>
                    </select>
                    <p className={FIELD_HELPER}>ต้องชั่งเปลือกใหม่เมื่อไร</p>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Acceptance Min – Max</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        className={FIELD_INPUT}
                        placeholder="0.0900"
                        aria-label="Acceptance Min"
                        data-testid="tare-new-min"
                        value={newTare.min}
                        onChange={(e) => setNewTare({ ...newTare, min: e.target.value })}
                      />
                      <span className="text-xs text-slate-400">–</span>
                      <input
                        type="number"
                        step="any"
                        className={FIELD_INPUT}
                        placeholder="0.1100"
                        aria-label="Acceptance Max"
                        data-testid="tare-new-max"
                        value={newTare.max}
                        onChange={(e) => setNewTare({ ...newTare, max: e.target.value })}
                      />
                    </div>
                    <p className={FIELD_HELPER}>ไม่บังคับ — ใช้เตือนเมื่อเปลือกผิดน้ำหนัก</p>
                  </div>
                </div>

                {newTareError && (
                  <p className="flex items-start gap-1.5 text-[11px] text-[#c0362c]">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{newTareError}</span>
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="tare-create-submit"
                    disabled={createTare.isPending}
                    onClick={submitNewTare}
                    className="rounded-full bg-cyan-700 px-4 py-2 text-[12px] font-medium text-white transition hover:bg-cyan-800 disabled:opacity-60"
                  >
                    {createTare.isPending ? 'กำลังสร้าง…' : 'สร้างแล้วเลือกใช้เลย'}
                  </button>
                  <span className="text-[11px] text-slate-500">
                    บันทึกเป็นหัวข้อแยกทันที — เกณฑ์ที่กำลังกรอกอยู่ยังไม่ถูกบันทึก
                  </span>
                </div>
              </div>
            )}

          </div>

          {linkedTare ? (
            /* Everything the linked criterion says, so the choice can be checked
               without opening it. */
            <div
              data-testid="tare-source-summary"
              className="rounded-[12px] bg-[#f6f7f9] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-cyan-100 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-800">
                  {linkedTare.code}
                </span>
                <span className="text-[13px] font-semibold text-slate-800">{linkedTare.name}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                {[
                  { k: 'หน่วย', v: linkedTare.unit || '—' },
                  {
                    k: 'ช่วงที่ยอมรับ',
                    v: linkedTare.acceptanceMin || linkedTare.acceptanceMax
                      ? `${linkedTare.acceptanceMin || '—'} – ${linkedTare.acceptanceMax || '—'}`
                      : '—',
                  },
                  {
                    k: 'อายุค่า Tare',
                    v: linkedTare.expireAfter === 'shift'
                      ? 'จบกะ'
                      : linkedTare.expireAfter === 'permanent'
                        ? 'ใช้ได้ตลอด'
                        : 'จบ batch',
                  },
                  { k: 'Store As', v: linkedTare.storeAs || '—' },
                ].map((f) => (
                  <div key={f.k} className="flex flex-col">
                    <span className="text-[10px] text-slate-400">{f.k}</span>
                    <span className="text-[12px] font-medium text-slate-700">{f.v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-cyan-700">
                ผูกไว้แล้ว — ไม่ต้องตั้งค่าการชั่งเปลือกในหัวข้อนี้อีก
                ตอนบันทึกผลจะดึงค่า Tare จากเกณฑ์นี้มาให้
              </p>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                v: 'per_unit' as const,
                title: 'ชั่งทีละหน่วย',
                sub: 'ชั่งเปลือกเปล่าทีละหน่วย เป็นตาราง 1 แถวต่อ 1 หน่วย',
                why: 'ตรวจสอบย้อนกลับได้ว่าเปลือกหน่วยไหนผิดปกติ',
              },
              {
                v: 'bulk' as const,
                title: 'ชั่งรวม',
                sub: 'ชั่งเปลือกเปล่าพร้อมกัน กรอกน้ำหนักรวมครั้งเดียว',
                why: 'เร็วกว่า — หน่วยที่บรรจุแล้วยังชั่งทีละหน่วยเหมือนเดิม',
              },
            ].map((opt) => {
              const active = payload.tareMode === opt.v;
              return (
                <button
                  type="button"
                  key={opt.v}
                  data-testid={`tare-mode-${opt.v}`}
                  aria-pressed={active}
                  onClick={() => onChange({ ...payload, tareMode: opt.v })}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                    active
                      ? 'border-[#9db9e8] bg-[#e8effc] text-[#3559b0]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#9db9e8]',
                  )}
                >
                  <span className="text-sm font-semibold">{opt.title}</span>
                  <span className="text-[11px] opacity-80">{opt.sub}</span>
                  <span className="text-[10px] opacity-60">{opt.why}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={FIELD_LABEL}>ชื่อหัวข้อการบันทึก</label>
              <input
                className={FIELD_INPUT}
                placeholder="เช่น น้ำหนักแคปซูลเปล่า เบอร์ 0"
                data-testid="mp-tare-label"
                value={payload.tareLabel}
                onChange={(e) => onChange({ ...payload, tareLabel: e.target.value })}
              />
              <p className={FIELD_HELPER}>
                ชื่อที่ operator จะเห็นตอนบันทึกผล — เว้นว่างได้ ระบบจะใช้ &quot;ชั่งแคปซูลเปล่า&quot;
              </p>
            </div>
            {/* Only the bulk weighing has a count of its own. Weighing one at
                a time pairs each shell with the unit filled into it, so the
                number of shells is the number of samples — asking for it twice
                invited the two to disagree. */}
            {payload.tareMode === 'bulk' && (
              <div>
                <label className={FIELD_LABEL}>
                  จำนวนเปลือกที่ชั่ง (Tare) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  className={FIELD_INPUT}
                  placeholder="10"
                  value={payload.tareCount}
                  onChange={(e) => onChange({ ...payload, tareCount: e.target.value })}
                />
                <p className={FIELD_HELPER}>ชั่งเปลือกเปล่าพร้อมกันกี่ชิ้น</p>
              </div>
            )}
          </div>
          </>
          )}

        </div>
        </>
      ) : section === 'per-unit' ? (
        <>
        <div className="flex flex-col gap-4 rounded-[16px] bg-[#f9fafb] p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#6b7280]" />
            <h4 className="text-sm font-semibold text-black">เกณฑ์ต่อหน่วย</h4>
            <span className="text-[11px] text-slate-400">หนึ่งหน่วยควรหนักเท่าไร และเบี่ยงได้แค่ไหน</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* What a หน่วย is, asked in the card whose every other label says
                "ต่อหน่วย" — it used to sit in the sampling step, a scroll away
                from the figures it names. */}
            <div className="sm:col-span-2">
              <label className={FIELD_LABEL}>ชื่อหน่วยที่ชั่ง</label>
              <input
                className={FIELD_INPUT}
                placeholder={payload.tareMode === 'bulk' ? 'เช่น "เม็ด"' : 'เช่น "หัวตอก" → "หัวตอก 1", "หัวตอก 2"...'}
                value={payload.pointLabel}
                onChange={(e) => onChange({ ...payload, pointLabel: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>
                Target ต่อหน่วย <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                className={FIELD_INPUT}
                placeholder="0.500"
                data-testid="mp-per-point-target"
                value={payload.perPointTarget}
                onChange={(e) => onChange({ ...payload, perPointTarget: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>±% Tolerance ต่อหน่วย</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  className={cn(FIELD_INPUT, 'pr-8')}
                  placeholder="7.5"
                  data-testid="mp-per-point-tolerance"
                  value={payload.perPointTolerance}
                  onChange={(e) => onChange({ ...payload, perPointTolerance: e.target.value })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>
        </div>
        </>
      ) : (
        <>
        <div className="flex flex-col gap-4 rounded-[16px] bg-[#f9fafb] p-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6b7280]" />
            <h4 className="text-sm font-semibold text-black">การตั้งค่าการผลิต</h4>
            <span className="text-[11px] text-slate-400">Aggregate / Batch Verdict</span>
          </div>

        <div>
          <label className={FIELD_LABEL}>Aggregate Rule <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { v: 'all_pass', t: 'ทุกหน่วยต้องผ่าน', d: 'All Pass' },
              { v: 'mean', t: 'เฉลี่ยอยู่ในช่วง', d: 'Mean in range' },
              { v: 'rsd', t: 'ความเบี่ยงเบนต่ำ', d: 'RSD ≤ limit' },
              { v: 'min_max', t: 'ทุกหน่วยอยู่ในช่วง', d: 'Min/Max bound' },
            ].map((opt) => {
              const active = payload.aggregateRule === opt.v;
              return (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => onChange({ ...payload, aggregateRule: opt.v as MultiPointPayload['aggregateRule'] })}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs font-medium transition-colors',
                    active
                      ? 'bg-[#e8effc] border-[#9db9e8] text-[#3559b0]'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-[#9db9e8]',
                  )}
                >
                  <span className="font-semibold">{opt.t}</span>
                  <span className="text-[10px] opacity-70">{opt.d}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={cn(FIELD_LABEL, 'flex items-center gap-1.5')}>
            Aggregate Limit
            {(payload.aggregateRule === 'mean' || payload.aggregateRule === 'min_max') && <AutoBadge />}
          </label>
          <input
            className={cn(
              FIELD_INPUT,
              (payload.aggregateRule === 'mean' || payload.aggregateRule === 'min_max') && 'bg-emerald-50/40 border-emerald-200',
            )}
            placeholder={payload.aggregateRule === 'rsd' ? 'เช่น 2.0 (% RSD)' : '0.4625-0.5375'}
            value={payload.aggregateLimit}
            readOnly={payload.aggregateRule === 'mean' || payload.aggregateRule === 'min_max'}
            onChange={(e) => onChange({ ...payload, aggregateLimit: e.target.value })}
          />
          <p className={FIELD_HELPER}>
            {payload.aggregateRule === 'rsd'
              ? 'ระบุ RSD limit เป็น %'
              : payload.aggregateRule === 'all_pass'
              ? 'ใช้ Target ± Tolerance ของแต่ละหน่วย'
              : 'คำนวณอัตโนมัติจาก Target ± Tolerance%'}
          </p>
        </div>
        </div>
        </>
      )}

    </div>
  );
}

// ── Tare section ───────────────────────────────────────────────────
function TareSection({ payload, onChange }: { payload: TarePayload; onChange: (p: TarePayload) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-[#6b7280]" />
        <h3 className="text-sm font-semibold text-black">Tare Reference Specification</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>Reference Label <span className="text-red-500">*</span></label>
          <input
            className={FIELD_INPUT}
            placeholder="น้ำหนักภาชนะเปล่า"
            value={payload.referenceLabel}
            onChange={(e) => onChange({ ...payload, referenceLabel: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Reference Unit</label>
          <input
            className={FIELD_INPUT}
            placeholder="g"
            value={payload.referenceUnit}
            onChange={(e) => onChange({ ...payload, referenceUnit: e.target.value })}
          />
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'flex items-center gap-1')}>
            Store As (symbol)
            <InfoTip
              text="ชื่อย่อที่ใช้เรียกค่า Tare นี้ในสูตรคำนวณ — ตั้งเป็น tare_empty_cap แล้วในการ์ด การคำนวณที่ได้จากผล เขียนสูตรได้เลยว่า (gross − tare_empty_cap) โดยไม่ต้องพิมพ์ Code ยาว ๆ · ใช้ตัวอักษรอังกฤษพิมพ์เล็กกับ _ เท่านั้น ถ้าเว้นว่าง ระบบจะใช้ Code ของเกณฑ์นี้แทน"
              testId="tare-store-as-info"
            />
          </label>
          <input
            className={FIELD_INPUT}
            placeholder="tare_empty_cap"
            value={payload.storeAs}
            onChange={(e) => onChange({ ...payload, storeAs: e.target.value })}
          />
          <p className={FIELD_HELPER}>ชื่อย่อสำหรับอ้างอิงในสูตร calculated</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>Expire After</label>
          <select
            className={FIELD_INPUT}
            value={payload.expireAfter}
            onChange={(e) => onChange({ ...payload, expireAfter: e.target.value as TarePayload['expireAfter'] })}
          >
            <option value="batch">หมดอายุเมื่อจบ batch</option>
            <option value="shift">หมดอายุเมื่อจบกะ</option>
            <option value="permanent">ใช้ได้ตลอด (permanent)</option>
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL}>Acceptance Min</label>
          <input
            type="number"
            step="any"
            className={FIELD_INPUT}
            placeholder="0.0900"
            value={payload.acceptanceMin}
            onChange={(e) => onChange({ ...payload, acceptanceMin: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Acceptance Max</label>
          <input
            type="number"
            step="any"
            className={FIELD_INPUT}
            placeholder="0.1100"
            value={payload.acceptanceMax}
            onChange={(e) => onChange({ ...payload, acceptanceMax: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Calibration section ────────────────────────────────────────────
function CalibrationSection({ payload, onChange }: { payload: CalibrationPayload; onChange: (p: CalibrationPayload) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-4 h-4 text-[#6b7280]" />
        <h3 className="text-sm font-semibold text-black">Calibration Specification</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>Instrument Name <span className="text-red-500">*</span></label>
          <input className={FIELD_INPUT} placeholder="เช่น Digital Caliper"
            value={payload.instrumentName}
            onChange={(e) => onChange({ ...payload, instrumentName: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Instrument ID</label>
          <input className={FIELD_INPUT} placeholder="INS-001"
            value={payload.instrumentId}
            onChange={(e) => onChange({ ...payload, instrumentId: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Standard Value <span className="text-red-500">*</span></label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder="100.000"
            value={payload.standardValue}
            onChange={(e) => onChange({ ...payload, standardValue: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Standard Unit</label>
          <input className={FIELD_INPUT} placeholder="mm"
            value={payload.standardUnit}
            onChange={(e) => onChange({ ...payload, standardUnit: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Tolerance Type</label>
          <select className={FIELD_INPUT}
            value={payload.toleranceType}
            onChange={(e) => onChange({ ...payload, toleranceType: e.target.value as CalibrationPayload['toleranceType'] })}>
            <option value="percent">Percent (%)</option>
            <option value="absolute">Absolute (unit)</option>
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL}>Tolerance Value</label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder={payload.toleranceType === 'percent' ? '5' : '0.05'}
            value={payload.toleranceValue}
            onChange={(e) => onChange({ ...payload, toleranceValue: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Last Calibration Date</label>
          <input type="date" className={FIELD_INPUT}
            value={payload.lastCalibrationDate}
            onChange={(e) => onChange({ ...payload, lastCalibrationDate: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Next Due Date</label>
          <input type="date" className={FIELD_INPUT}
            value={payload.nextDueDate}
            onChange={(e) => onChange({ ...payload, nextDueDate: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={payload.requiresPriorPass}
              onChange={(e) => onChange({ ...payload, requiresPriorPass: e.target.checked })} />
            ต้องผ่าน calibration ก่อนจึงจะเริ่มผลิตได้ (block production until pass)
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Calculated section ─────────────────────────────────────────────
function CalculatedSection({ payload, onChange }: { payload: CalculatedPayload; onChange: (p: CalculatedPayload) => void }) {
  const addInput = () => onChange({
    ...payload,
    inputs: [
      ...payload.inputs,
      {
        id: `inp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '', source: 'derived', criteriaCode: '', constantValue: '',
      },
    ],
  });
  const updateInput = (id: string, patch: Partial<CalculatedInput>) =>
    onChange({ ...payload, inputs: payload.inputs.map((i) => i.id === id ? { ...i, ...patch } : i) });
  const removeInput = (id: string) =>
    onChange({ ...payload, inputs: payload.inputs.filter((i) => i.id !== id) });

  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-[#6b7280]" />
        <h3 className="text-sm font-semibold text-black">Calculated Specification</h3>
      </div>

      <div>
        <label className={FIELD_LABEL}>Formula <span className="text-red-500">*</span></label>
        <input className={cn(FIELD_INPUT, 'font-mono text-sm')}
          placeholder="(gross - tare) / batch_size * 100"
          value={payload.formula}
          onChange={(e) => onChange({ ...payload, formula: e.target.value })} />
        <p className={FIELD_HELPER}>ตัวแปรในสูตรต้องตรงกับ name ของ Inputs ด้านล่าง — ตัวอย่าง: <code>Yield = output / input * 100</code>, <code>%LOD = (wet - dry) / wet * 100</code></p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={FIELD_LABEL}>Inputs (ตัวแปรในสูตร)</label>
          <button type="button" onClick={addInput}
            className="flex items-center gap-1 rounded-full bg-[#e8effc] px-2.5 py-1 text-xs font-medium text-[#3559b0] transition hover:bg-[#dbe6fb]">
            <Plus className="w-3 h-3" /> เพิ่ม input
          </button>
        </div>
        {payload.inputs.length === 0 ? (
          <div className="rounded-[12px] bg-[#f9fafb] py-4 text-center text-xs text-[#bfbfbf]">
            ยังไม่มี input — กด "เพิ่ม input" เพื่อกำหนดตัวแปรในสูตร
          </div>
        ) : (
          <div className="space-y-2">
            {payload.inputs.map((inp) => (
              <div key={inp.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-2 rounded-lg bg-white border border-slate-200">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-500">name (in formula)</label>
                  <input className={cn(FIELD_INPUT, 'text-xs font-mono')}
                    placeholder="gross" value={inp.name}
                    onChange={(e) => updateInput(inp.id, { name: e.target.value })} />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[10px] text-slate-500">source</label>
                  <select className={cn(FIELD_INPUT, 'text-xs')}
                    value={inp.source}
                    onChange={(e) => updateInput(inp.id, { source: e.target.value as CalculatedInput['source'] })}>
                    <option value="derived">From criteria code</option>
                    <option value="this_step">From this step</option>
                    <option value="constant">Constant</option>
                  </select>
                </div>
                <div className="sm:col-span-6">
                  {inp.source === 'constant' ? (
                    <>
                      <label className="text-[10px] text-slate-500">constant value</label>
                      <input type="number" step="any" className={cn(FIELD_INPUT, 'text-xs font-mono')}
                        placeholder="100" value={inp.constantValue}
                        onChange={(e) => updateInput(inp.id, { constantValue: e.target.value })} />
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] text-slate-500">criteria code</label>
                      <input className={cn(FIELD_INPUT, 'text-xs font-mono')}
                        placeholder="IPC-WV-001" value={inp.criteriaCode}
                        onChange={(e) => updateInput(inp.id, { criteriaCode: e.target.value })} />
                    </>
                  )}
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeInput(inp.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className={FIELD_LABEL}>Result Unit</label>
          <input className={FIELD_INPUT} placeholder="%"
            value={payload.resultUnit}
            onChange={(e) => onChange({ ...payload, resultUnit: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Result Min</label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder="90"
            value={payload.resultMin}
            onChange={(e) => onChange({ ...payload, resultMin: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Result Max</label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder="105"
            value={payload.resultMax}
            onChange={(e) => onChange({ ...payload, resultMax: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Decimals</label>
          <input type="number" min={0} max={6} className={FIELD_INPUT}
            value={payload.displayDecimals}
            onChange={(e) => onChange({ ...payload, displayDecimals: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ── Custom Multi-Field section ─────────────────────────────────────
function CustomFieldsSection({ payload, onChange }: { payload: CustomMultiFieldPayload; onChange: (p: CustomMultiFieldPayload) => void }) {
  const addField = () => onChange({
    ...payload,
    fields: [
      ...payload.fields,
      {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '', fieldType: 'number', unit: '', target: '', tolerance: '',
        required: true, note: '', options: '',
      },
    ],
  });
  const updateField = (id: string, patch: Partial<CustomField>) =>
    onChange({ ...payload, fields: payload.fields.map((f) => f.id === id ? { ...f, ...patch } : f) });
  const removeField = (id: string) =>
    onChange({ ...payload, fields: payload.fields.filter((f) => f.id !== id) });

  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-[#6b7280]" />
        <h3 className="text-sm font-semibold text-black">Custom Multi-Field Specification</h3>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={FIELD_LABEL}>Fields ({payload.fields.length})</label>
          <button type="button" onClick={addField}
            className="flex items-center gap-1 rounded-full bg-[#e8effc] px-2.5 py-1 text-xs font-medium text-[#3559b0] transition hover:bg-[#dbe6fb]">
            <Plus className="w-3 h-3" /> เพิ่มฟิลด์
          </button>
        </div>
        {payload.fields.length === 0 ? (
          <div className="rounded-[12px] bg-[#f9fafb] py-4 text-center text-xs text-[#bfbfbf]">
            ยังไม่มีฟิลด์ — กด "เพิ่มฟิลด์" เพื่อกำหนด
          </div>
        ) : (
          <div className="space-y-2">
            {payload.fields.map((f) => (
              <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-slate-500">Label</label>
                    <input className={cn(FIELD_INPUT, 'text-xs')}
                      placeholder="ความหนา" value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500">Type</label>
                    <select className={cn(FIELD_INPUT, 'text-xs')}
                      value={f.fieldType}
                      onChange={(e) => updateField(f.id, { fieldType: e.target.value as CustomField['fieldType'] })}>
                      <option value="number">Number</option>
                      <option value="text">Text</option>
                      <option value="select">Select</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500">Unit</label>
                    <input className={cn(FIELD_INPUT, 'text-xs')}
                      placeholder="mm" value={f.unit}
                      onChange={(e) => updateField(f.id, { unit: e.target.value })} />
                  </div>
                  {f.fieldType === 'number' && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500">Target</label>
                        <input type="number" step="any" className={cn(FIELD_INPUT, 'text-xs')}
                          value={f.target}
                          onChange={(e) => updateField(f.id, { target: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500">± %</label>
                        <input type="number" step="any" className={cn(FIELD_INPUT, 'text-xs')}
                          value={f.tolerance}
                          onChange={(e) => updateField(f.id, { tolerance: e.target.value })} />
                      </div>
                    </>
                  )}
                  {f.fieldType === 'select' && (
                    <div className="sm:col-span-4">
                      <label className="text-[10px] text-slate-500">Options (comma-separated)</label>
                      <input className={cn(FIELD_INPUT, 'text-xs')}
                        placeholder="opt1, opt2, opt3" value={f.options}
                        onChange={(e) => updateField(f.id, { options: e.target.value })} />
                    </div>
                  )}
                  <div className="sm:col-span-1 flex items-end justify-end">
                    <button type="button" onClick={() => removeField(f.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })} />
                    required
                  </label>
                  <input className={cn(FIELD_INPUT, 'text-xs flex-1 ml-3')}
                    placeholder="note (optional)" value={f.note}
                    onChange={(e) => updateField(f.id, { note: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={FIELD_LABEL}>General Note</label>
        <textarea className={cn(FIELD_INPUT, 'min-h-[60px]')}
          placeholder="หมายเหตุทั่วไป"
          value={payload.generalNote}
          onChange={(e) => onChange({ ...payload, generalNote: e.target.value })} />
      </div>
    </div>
  );
}

// ── Pass / Fail section ────────────────────────────────────────────
function PassFailSection({ payload, onChange }: { payload: PassFailPayload; onChange: (p: PassFailPayload) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-[#6b7280]" />
        <h3 className="text-sm font-semibold text-black">เกณฑ์การตัดสินใจ Pass / Fail</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <label className="text-sm font-semibold text-emerald-700">เกณฑ์ &quot;ผ่าน&quot; (PASS)</label>
          </div>
          <textarea
            className={cn(FIELD_INPUT, 'min-h-[80px] resize-none')}
            placeholder="เช่น ฉลากติดถูกต้อง ครบถ้วน ไม่บิดเบี้ยว"
            value={payload.passDefinition}
            onChange={(e) => onChange({ ...payload, passDefinition: e.target.value })}
          />
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">✕</span>
            <label className="text-sm font-semibold text-red-700">เกณฑ์ &quot;ไม่ผ่าน&quot; (FAIL)</label>
          </div>
          <textarea
            className={cn(FIELD_INPUT, 'min-h-[80px] resize-none')}
            placeholder="เช่น ฉลากบิด ฉีกขาด หรือพิมพ์ไม่ชัด"
            value={payload.failDefinition}
            onChange={(e) => onChange({ ...payload, failDefinition: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Visual section ─────────────────────────────────────────────────
function VisualSection({ payload, onChange }: { payload: VisualPayload; onChange: (p: VisualPayload) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-4 h-4 text-[#6b7280]" />
        <h3 className="text-sm font-semibold text-black">เกณฑ์การตรวจด้วยสายตา (Visual Inspection)</h3>
      </div>
      <div className="mb-4">
        <label className={FIELD_LABEL}>คำอธิบายลักษณะที่ยอมรับ <span className="text-red-500">*</span></label>
        <textarea
          className={cn(FIELD_INPUT, 'min-h-[80px] resize-none')}
          placeholder="เช่น เม็ดยาสีน้ำตาลอ่อน ผิวเรียบ ไม่มีรอยร้าว ไม่มีจุดดำ"
          value={payload.description}
          onChange={(e) => onChange({ ...payload, description: e.target.value })}
        />
      </div>
      <div className="mb-4">
        <label className={FIELD_LABEL}>Checklist รายการที่ต้องตรวจ</label>
        <div className="space-y-2">
          {payload.checklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {idx + 1}
              </span>
              <input
                className={cn(FIELD_INPUT, 'flex-1')}
                placeholder="ระบุจุดที่ต้องตรวจ"
                value={item}
                onChange={(e) => {
                  const next = [...payload.checklist];
                  next[idx] = e.target.value;
                  onChange({ ...payload, checklist: next });
                }}
              />
              <button
                type="button"
                onClick={() => onChange({ ...payload, checklist: payload.checklist.filter((_, i) => i !== idx) })}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...payload, checklist: [...payload.checklist, ''] })}
            className="flex w-full items-center justify-center gap-1 rounded-[12px] bg-[#e8effc] py-2 text-xs font-medium text-[#3559b0] transition hover:bg-[#dbe6fb]"
          >
            <Plus className="w-3 h-3" /> เพิ่มรายการตรวจ
          </button>
        </div>
      </div>
      <div>
        <label className={FIELD_LABEL}>รูปอ้างอิง (Reference Image)</label>
        <input
          className={FIELD_INPUT}
          placeholder="URL หรือ path รูปภาพมาตรฐาน"
          value={payload.referenceImage}
          onChange={(e) => onChange({ ...payload, referenceImage: e.target.value })}
        />
        <p className={FIELD_HELPER}>รูปตัวอย่างที่ operator ใช้เปรียบเทียบ</p>
      </div>
    </div>
  );
}

// ── Text section ───────────────────────────────────────────────────
function TextSection({ payload, onChange }: { payload: TextPayload; onChange: (p: TextPayload) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-slate-700" />
        <h3 className="text-sm font-semibold text-black">รูปแบบการบันทึกข้อความ</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div>
          <label className={FIELD_LABEL}>รูปแบบที่คาดหวัง (Format)</label>
          <input
            className={FIELD_INPUT}
            placeholder="เช่น Lot YYYY-MM-DD-NNN"
            value={payload.format}
            onChange={(e) => onChange({ ...payload, format: e.target.value })}
          />
          <p className={FIELD_HELPER}>รูปแบบ / pattern ของข้อความที่ต้องบันทึก</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>ตัวอย่าง (Example)</label>
          <input
            className={FIELD_INPUT}
            placeholder="เช่น Lot 2025-11-25-001"
            value={payload.example}
            onChange={(e) => onChange({ ...payload, example: e.target.value })}
          />
          <p className={FIELD_HELPER}>ตัวอย่างค่าที่ถูกต้อง</p>
        </div>
        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span className={cn('relative w-10 h-6 rounded-full transition-colors', payload.required ? 'bg-emerald-500' : 'bg-slate-300')}>
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', payload.required ? 'translate-x-4' : 'translate-x-0')} />
            </span>
            <span className="text-sm font-medium text-slate-700">บังคับให้กรอก (Required)</span>
            <input type="checkbox" className="sr-only" checked={payload.required} onChange={(e) => onChange({ ...payload, required: e.target.checked })} />
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashed stroke used everywhere a stage is conditional — the stepper rail, the
 * Stage 2+ card outline, the add-stage button and the trailing node.
 *
 * The width is what sets the dash length: a browser draws roughly a 3:1 dash
 * from the border width, so this is the only way to make the dashes longer
 * without dropping to a gradient, which would lose the 14px corner radius.
 */
const DASH = 'border-[3px] border-dashed';

/**
 * What each On Fail choice means, in one place — the stepper node, its rail
 * segment and the button below it all read from this so they cannot drift.
 */
const ON_FAIL_META: Record<
  AcceptanceStage['onFail'],
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string; button: string }
> = {
  next_stage: {
    icon: ArrowDown,
    color: '#d0631c',
    label: 'ไม่ผ่าน → ทดสอบ Stage ถัดไป',
    button: 'bg-[#fff8e6] ring-2 ring-[#d0631c] text-[#d0631c]',
  },
  reject_batch: {
    icon: X,
    color: '#c0362c',
    label: 'ไม่ผ่าน → Reject Batch',
    button: 'bg-[#fbeceb] ring-2 ring-[#c0362c] text-[#c0362c]',
  },
  deviation: {
    icon: TriangleAlert,
    color: '#c2410c',
    label: 'ไม่ผ่าน → บันทึก Deviation',
    button: 'bg-[#fff7ed] ring-2 ring-[#c2410c] text-[#c2410c]',
  },
};

/**
 * Numbered node on the stepper rail. Stage 1 is filled because it always runs;
 * later stages are outlined and dashed, the same language the cards use.
 */
function StepNode({ onFail, placeholder }: { onFail?: AcceptanceStage['onFail']; placeholder?: boolean }) {
  if (placeholder || !onFail) {
    return (
      <span
        aria-hidden
        className={cn(DASH, 'flex h-8 w-8 items-center justify-center rounded-full border-[#e1e4e8] text-[#bfbfbf]')}
      >
        <Plus className="h-4 w-4" />
      </span>
    );
  }
  const meta = ON_FAIL_META[onFail];
  const Icon = meta.icon;
  return (
    <span
      role="img"
      aria-label={meta.label}
      title={meta.label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: meta.color }}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

// ── Stage card (multi-stage) ───────────────────────────────────────
interface StageCardProps {
  idx: number;
  isLast: boolean;
  stage: AcceptanceStage;
  onChange: (patch: Partial<AcceptanceStage>) => void;
}

function StageCard({ idx, isLast, stage, onChange }: StageCardProps) {
  const math = calcStageAcceptance(stage);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border-[#f1f3f5] bg-white',
        // Stage 1 always runs; every later stage is conditional, and the dashed
        // outline is what says so at a glance.
        idx === 0 ? 'border-[1.5px] border-solid' : DASH,
      )}
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SoftLabel label="Sample Size">
            <NumberInput
              className={SOFT_INPUT}
              ariaLabel={`Sample Size — Stage ${idx + 1}`}
              min={1}
              value={stage.sampleSize}
              onChange={(v) => onChange({ sampleSize: v ?? 1 })}
            />
          </SoftLabel>
          <SoftLabel label="เกณฑ์การยอมรับ">
            <div className="relative">
              <NumberInput
                className={cn(SOFT_INPUT, 'pr-8')}
                ariaLabel={`เกณฑ์การยอมรับ — Stage ${idx + 1}`}
                min={0}
                max={100}
                value={stage.tolerancePercent}
                onChange={(v) => onChange({ tolerancePercent: v ?? 0 })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
          </SoftLabel>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <AcceptanceStat
            testId={`stage-${idx}-stat-tested`}
            surface="bg-[#fbfbfb]"
            icon={<User className="h-4 w-4" />}
            label="ทดสอบ"
            value={math.sampleSize}
            unit="ชิ้น"
            color="#5682e9"
          />
          <AcceptanceStat
            testId={`stage-${idx}-stat-allowed`}
            surface="bg-[#fbfbfb]"
            icon={<ClockAlert className="h-4 w-4" />}
            label="ยอมเสียได้"
            value={math.allowedFail}
            unit="ไม่เกินกี่ชิ้น"
            color="#fc9709"
          />
          <AcceptanceStat
            testId={`stage-${idx}-stat-must-pass`}
            surface="bg-[#fbfbfb]"
            icon={<ScanFace className="h-4 w-4" />}
            label="ต้องผ่าน"
            value={math.mustPass}
            unit="ขั้นต่ำ"
            color="#27ae60"
          />
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-[13px] font-semibold text-slate-700">เมื่อ Stage นี้ไม่ผ่าน (On Fail)</p>
          <div className="flex flex-col gap-6 sm:flex-row">
            <OnFailButton
              active={stage.onFail === 'next_stage'}
              disabled={isLast}
              onClick={() => onChange({ onFail: 'next_stage' })}
              label="ทดสอบ Stage ถัดไป"
              activeStyle={ON_FAIL_META.next_stage.button}
            />
            <OnFailButton
              active={stage.onFail === 'reject_batch'}
              onClick={() => onChange({ onFail: 'reject_batch' })}
              label="Reject Batch"
              activeStyle={ON_FAIL_META.reject_batch.button}
            />
            <OnFailButton
              active={stage.onFail === 'deviation'}
              onClick={() => onChange({ onFail: 'deviation' })}
              label="บันทึก Deviation"
              activeStyle={ON_FAIL_META.deviation.button}
            />
          </div>
        </div>
      </div>

      {/* Deviation preview — attached to the bottom edge of the card, as a
          consequence of the choice above rather than a box floating inside it. */}
      {stage.onFail === 'deviation' && (
        <div
          data-testid={`stage-${idx}-deviation`}
          className="border-t-[1.5px] border-[#ffdeb0] bg-[#fff7ed]"
        >
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Info className="h-[18px] w-[18px] shrink-0 text-[#c2410c]" />
                <span className="text-xs font-medium text-[#c2410c]">
                  Deviation Record (Auto-generated)
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1.5 font-mono text-[11px] font-medium text-[#c2410c]">
                DEV-{new Date().getFullYear()}-XXXX
              </span>
            </div>
            <div className="flex flex-col gap-3 text-[11px] sm:flex-row sm:gap-6">
              <DevField label="Type" value="Quality / IPC Failure" />
              <DevField label="Severity" value="Minor → Investigate" />
            </div>
            <div className="flex flex-col gap-3 text-[11px] sm:flex-row sm:gap-6">
              <DevField label="Source" value={`Stage ${idx + 1}`} />
              <DevField label="Status" value="Pending Investigation" valueColor="text-[#fc9709]" />
            </div>
            <div className="flex flex-col gap-3 text-[11px] sm:flex-row sm:gap-6">
              <DevField label="Assignee" value="QA Manager" />
              <DevField label="SLA" value="24 ชม." />
            </div>
          </div>
          <div className="border-t-[1.5px] border-[#ffdeb0] px-6 py-4">
            <p className="text-xs font-medium text-[#c2410c]">
              Batch จะถูก HOLD รอ QA ตัดสินใจ — Accept with justification, Rework, หรือ Reject
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * True when the stages on screen are exactly this pharmacopoeia plan, so the
 * button can show that it is the one in force. Compares sample sizes and the
 * fail action — the two things the plan actually fixes.
 */
function matchesPlan(stages: AcceptanceStage[], plan: AcceptanceStage[]): boolean {
  return (
    stages.length === plan.length &&
    stages.every((s, i) => s.sampleSize === plan[i].sampleSize && s.onFail === plan[i].onFail)
  );
}

function PresetButton({
  active,
  onClick,
  title,
  plan,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  /** The stage sequence the plan produces, e.g. "6 → 6 → 12". */
  plan: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        'flex h-10 flex-1 items-center justify-center gap-3 rounded-[12px] px-4 transition',
        active
          ? 'bg-[#f7fafe] ring-2 ring-[#5682e9]'
          : 'border-[1.5px] border-[#f1f3f5] hover:bg-[#f8f9fa]',
      )}
    >
      <span className={cn('text-[13px]', active ? 'text-[#2f6fd0]' : 'text-[#bfbfbf]')}>{title}</span>
      <span className={cn('text-xs', active ? 'text-[#2f6fd0]/70' : 'text-black/40')}>{plan}</span>
    </button>
  );
}

function OnFailButton({ active, disabled, onClick, label, activeStyle }: { active: boolean; disabled?: boolean; onClick: () => void; label: string; activeStyle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active && !disabled}
      className={cn(
        'flex h-10 flex-1 items-center justify-center rounded-[12px] px-4 text-[13px] transition',
        active && !disabled
          ? activeStyle
          : 'border-[1.5px] border-[#f1f3f5] text-[#bfbfbf] hover:bg-[#f8f9fa]',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {label}
    </button>
  );
}

function DevField({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span className="text-black/40">{label} :</span>
      <span className={cn('truncate font-medium', valueColor ?? 'text-black')}>{value}</span>
    </div>
  );
}

/** Card shell for the side column — the same one the form cards use. */
const SIDE_CARD = 'rounded-[24px] bg-white shadow-[0_4px_4px_rgba(0,0,0,0.1)]';

/**
 * One step of the acceptance flow — Figma 79:10574. The ordinal is the biggest
 * thing in the row because the order is the point; the two numbers that decide
 * accept or reject are the only coloured text.
 */
function AcceptanceStep({
  index,
  sampleSize,
  allowedFail,
  tolerancePercent,
  onFail,
}: {
  index: number;
  sampleSize: number;
  allowedFail: number;
  tolerancePercent: number;
  /** Present only for multi-stage; drives the dashed outline. */
  onFail?: AcceptanceStage['onFail'];
}) {
  return (
    <div
      data-testid={`acceptance-step-${index}`}
      className={cn(
        'flex items-center gap-3 rounded-[16px] border-[1.5px] border-[#f1f3f5] p-4',
        // A stage after the first only runs if the one before it failed, the
        // same thing the dashed stage cards say on the left.
        index > 0 && 'border-dashed',
      )}
    >
      <span className="w-9 shrink-0 text-2xl font-semibold leading-none text-black">
        {index + 1}.
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[13px] font-semibold">
          <span className="font-normal text-[#bfbfbf]">สุ่ม </span>
          <span className="text-[#80b45f]">{sampleSize}</span>
          <span className="font-normal text-[#bfbfbf]"> ชิ้น · เสียได้ </span>
          <span className="text-[#f84f4f]">{allowedFail}</span>
        </p>
        <p className="text-[11px]">
          <span className="text-[#bfbfbf]">tolerance : </span>
          <span className="font-bold text-[#80b45f]">{tolerancePercent}%</span>
          {onFail && (
            <span className="text-[#bfbfbf]"> · {ON_FAIL_META[onFail].label.replace('ไม่ผ่าน → ', 'ไม่ผ่าน → ')}</span>
          )}
        </p>
      </div>
    </div>
  );
}

/** Summary tile — Figma 79:10788. Fixed share of the row so the three stay
 *  the same width whatever the numbers are. */
function SummaryTile({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-[16px] bg-[#fbfbfb] px-2 py-2.5">
      <span className="text-center text-[10px] font-medium text-black/60">{label}</span>
      <span className="flex items-baseline justify-center gap-1">
        <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
        <span className="text-[10px] text-black/40">{unit}</span>
      </span>
    </div>
  );
}

// ── Live Preview Panel ─────────────────────────────────────────────
interface LivePreviewProps {
  formData: Partial<IPCCriteria>;
  /** Empty until the author picks one; the panel then shows what it needs. */
  criteriaType: CriteriaType | '';
  calculatedMinMax: { min: number; max: number } | null;
  acceptanceMath: { sampleSize: number; allowedFail: number; mustPass: number } | null;
  multiStageEnabled: boolean;
  stages: AcceptanceStage[];
  specPayload: SpecPayload | null;
  stage: StageValue;
}

function LivePreviewPanel({ formData, criteriaType, calculatedMinMax, acceptanceMath, multiStageEnabled, stages, specPayload, stage }: LivePreviewProps) {
  /*
   * With no type picked there is nothing to preview.
   *
   * The panel's job is to show the operator's screen as the author builds it,
   * and the type is what decides which screen that is — a numeric row, a
   * checklist, a weighing table. Drawing one of them before the choice is made
   * shows a screen nobody asked for, and the author reads it as a decision
   * already taken. So the panel says what it is waiting for, keeps its own
   * frame so the column does not jump when the answer arrives, and leaves the
   * downstream cards out: an acceptance ladder and a summary of a criterion
   * that has no type yet are both summaries of nothing.
   */
  if (!criteriaType) {
    return (
      <div
        data-testid="preview-empty"
        className="flex flex-col items-center gap-2 rounded-[24px] bg-white px-6 py-14 text-center shadow-[0_4px_4px_rgba(0,0,0,0.1)]"
      >
        <FlaskConical className="h-6 w-6 text-[#cfd6e0]" aria-hidden />
        <p className="text-[13px] font-medium text-slate-600">ยังไม่ได้เลือกประเภทเกณฑ์</p>
        <p className="max-w-[300px] text-[12px] leading-relaxed text-[#9aa3ad]">
          เลือกประเภทเกณฑ์ก่อน แล้วตรงนี้จะแสดงตัวอย่างหน้าจอที่ผู้ปฏิบัติงานจะเห็นตอนบันทึกผล
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Specification + recording mock — Figma node 8:4886 */}
      <IPCLivePreviewCard
        formData={formData}
        criteriaType={criteriaType}
        calculatedMinMax={calculatedMinMax}
        acceptanceMath={acceptanceMath}
        multiStageEnabled={multiStageEnabled}
        stages={stages}
        specPayload={specPayload}
        stage={stage}
      />

      {/* ── ลำดับการยอมรับ — Figma node 79:10366 ────────────────
          One outlined row per stage, numbered, with the two figures the
          operator is held to picked out in colour. */}
      <div className={SIDE_CARD} data-testid="acceptance-flow-card">
        <div className="p-4 pb-0">
          <h4 className="text-sm font-semibold text-black">ลำดับการยอมรับ</h4>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {multiStageEnabled && stages.length > 0 ? (
            stages.map((s, i) => (
              <AcceptanceStep
                key={i}
                index={i}
                sampleSize={calcStageAcceptance(s).sampleSize}
                allowedFail={calcStageAcceptance(s).allowedFail}
                tolerancePercent={s.tolerancePercent}
                onFail={s.onFail}
              />
            ))
          ) : acceptanceMath ? (
            <AcceptanceStep
              index={0}
              sampleSize={acceptanceMath.sampleSize}
              allowedFail={acceptanceMath.allowedFail}
              tolerancePercent={formData.tolerancePercent ?? 0}
            />
          ) : (
            <div className={cn(DASH, 'rounded-[16px] border-[#e1e4e8] px-3 py-4 text-center text-[13px] text-[#bfbfbf]')}>
              ยังไม่ได้กำหนดแผนการสุ่ม
            </div>
          )}
        </div>
      </div>

      {/* ── สรุปผล — Figma node 79:10605 ───────────────────────── */}
      <div className={SIDE_CARD} data-testid="summary-card">
        <div className="p-4 pb-0">
          <h4 className="text-sm font-semibold text-black">สรุปผล</h4>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-stretch gap-3">
            <SummaryTile
              label="จำนวนขั้น"
              value={String(multiStageEnabled ? stages.length : 1)}
              unit="ขั้น"
              color="#5682e9"
            />
            <SummaryTile
              label="สุ่มสูงสุด"
              value={String(multiStageEnabled ? totalStageSamples(stages) : (formData.sampleSize ?? 0))}
              unit="ชิ้น"
              color="#fc9709"
            />
            <SummaryTile
              label="รอบการตรวจ"
              value={String(formData.checkIntervalMinutes ?? 30)}
              unit="นาที"
              color="#27ae60"
            />
          </div>

          {/* Full width of its own: the method is a phrase, not a number, and
              squeezing it into a quarter tile truncated every option. */}
          <div className="flex flex-col items-center gap-1.5 rounded-[16px] bg-[#fbfbfb] px-3 py-2.5">
            <span className="text-[10px] font-medium text-black/60">วิธีสุ่ม</span>
            <span className="max-w-full truncate text-base font-bold text-[#5682e9]">
              {SAMPLING_METHOD_OPTIONS.find((m) => m.value === formData.testMethod)?.label.split(' —')[0] ||
                '—'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

