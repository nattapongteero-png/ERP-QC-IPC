import * as React from 'react';

/**
 * Demo stand-ins for the remaining DevExtreme controls the QC screens use.
 *
 * Same reason as the other shims: DevExtreme is licensed per developer and may
 * not be redistributed, so it cannot travel inside a public static site. These
 * keep the props the screens pass and the soft styling the demo uses.
 */

const FIELD =
  'w-full rounded-[12px] border border-[#e1e4e8] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-[#bfbfbf] focus:border-[#9db9e8] focus:ring-2 focus:ring-[#5682e9]/20 disabled:bg-[#f5f6f8] disabled:text-slate-400';

type Option = Record<string, unknown>;

export function DxTextBox({
  value,
  onValueChange,
  onValueChanged,
  placeholder,
  disabled,
  mode,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  onValueChanged?: (e: { value: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  mode?: string;
  [key: string]: unknown;
}) {
  return (
    <input
      type={mode === 'password' ? 'password' : 'text'}
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        onValueChange?.(e.target.value);
        onValueChanged?.({ value: e.target.value });
      }}
      className={FIELD}
    />
  );
}

export function DxSelectBox({
  value,
  onValueChange,
  onValueChanged,
  items = [],
  valueExpr = 'value',
  displayExpr = 'text',
  placeholder,
  disabled,
}: {
  value?: unknown;
  onValueChange?: (v: unknown) => void;
  onValueChanged?: (e: { value: unknown }) => void;
  items?: Option[];
  valueExpr?: string;
  displayExpr?: string | ((o: Option) => string);
  placeholder?: string;
  disabled?: boolean;
  [key: string]: unknown;
}) {
  const label = (o: Option) =>
    typeof displayExpr === 'function' ? displayExpr(o) : String(o[displayExpr] ?? '');
  return (
    <select
      value={value == null ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        const hit = items.find((o) => String(o[valueExpr]) === raw);
        const next = hit ? hit[valueExpr] : raw || null;
        onValueChange?.(next);
        onValueChanged?.({ value: next });
      }}
      className={FIELD}
    >
      <option value="">{placeholder ?? '—'}</option>
      {items.map((o, i) => (
        <option key={i} value={String(o[valueExpr])}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

export function DxTagBox(props: Record<string, unknown>) {
  // Multi-select is not exercised by any demo screen; a read-only summary keeps
  // the layout honest without shipping the widget.
  const values = Array.isArray(props.value) ? (props.value as unknown[]) : [];
  return (
    <div className={FIELD}>
      {values.length ? values.join(', ') : String(props.placeholder ?? '—')}
    </div>
  );
}

export function DxSwitch({
  value,
  onValueChange,
  onValueChanged,
  disabled,
}: {
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  onValueChanged?: (e: { value: boolean }) => void;
  disabled?: boolean;
  [key: string]: unknown;
}) {
  const on = !!value;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => {
        onValueChange?.(!on);
        onValueChanged?.({ value: !on });
      }}
      className={
        'relative h-6 w-11 rounded-full transition ' + (on ? 'bg-[#2f6fd0]' : 'bg-[#d5d8dc]')
      }
    >
      <span
        className={
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ' +
          (on ? 'left-[22px]' : 'left-0.5')
        }
      />
    </button>
  );
}

export default DxTextBox;
