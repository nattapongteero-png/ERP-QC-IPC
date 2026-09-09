import * as React from 'react';

/**
 * Demo stand-in for DxDateBox.
 *
 * The real one wraps a DevExtreme DateBox with Buddhist-era formatting.
 * DevExtreme may not be redistributed, so the demo uses the browser's own date
 * input. The exported format helpers are kept so importers still type-check.
 */
export interface DxDateBoxProps {
  value?: Date | string | null;
  onValueChanged?: (e: { value: Date | null }) => void;
  placeholder?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export const buddhistDateFormat = { formatter: (d: Date) => d.toLocaleDateString('th-TH') };
export const buddhistDateTimeFormat = { formatter: (d: Date) => d.toLocaleString('th-TH') };

export function parseStringToDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function DxDateBox({ value, onValueChanged, placeholder, disabled }: DxDateBoxProps) {
  const iso =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === 'string'
        ? value.slice(0, 10)
        : '';
  return (
    <input
      type="date"
      value={iso}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onValueChanged?.({ value: e.target.value ? new Date(e.target.value) : null })}
      className="w-full rounded-[12px] border border-[#e1e4e8] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#9db9e8] focus:ring-2 focus:ring-[#5682e9]/20"
    />
  );
}

export default DxDateBox;
