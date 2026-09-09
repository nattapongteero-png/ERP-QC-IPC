import * as React from 'react';

/**
 * Demo stand-ins for the three DevExtreme inputs the work order screens use.
 *
 * DevExtreme is licensed per developer and its bundle prints "Redistribution
 * prohibited" — shipping it inside a public static site would be redistributing
 * it. These keep the props the screens pass and the soft styling the rest of
 * the demo uses, so the layout the reviewer is judging is unchanged.
 */

const FIELD =
  'w-full rounded-[12px] border border-[#e1e4e8] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-[#bfbfbf] focus:border-[#9db9e8] focus:ring-2 focus:ring-[#5682e9]/20 disabled:bg-[#f5f6f8] disabled:text-slate-400';

export function DxNumberBox({
  value,
  onValueChanged,
  placeholder,
  disabled,
  min,
  max,
  className,
}: {
  value?: number | null;
  onValueChanged?: (e: { value: number | undefined }) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) =>
        onValueChanged?.({ value: e.target.value === '' ? undefined : Number(e.target.value) })
      }
      className={className ? `${FIELD} ${className}` : FIELD}
    />
  );
}

export function DxTextArea({
  value,
  onValueChanged,
  placeholder,
  height,
  disabled,
}: {
  value?: string;
  onValueChanged?: (e: { value: string }) => void;
  placeholder?: string;
  height?: number;
  disabled?: boolean;
  [key: string]: unknown;
}) {
  return (
    <textarea
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      style={height ? { height } : undefined}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      className={`${FIELD} resize-none`}
    />
  );
}

export function DxLoadIndicator() {
  return (
    <span
      aria-label="กำลังโหลด"
      className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#e1e4e8] border-t-[#2f6fd0]"
    />
  );
}

export function DxLoadPanel() {
  return null;
}

export default DxLoadIndicator;
