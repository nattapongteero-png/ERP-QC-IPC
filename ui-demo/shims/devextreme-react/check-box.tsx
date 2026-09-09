import * as React from 'react';

/** `devextreme-react/check-box` — a plain checkbox with the same props. */
export function CheckBox({
  value = false,
  onValueChanged,
  disabled,
  text,
}: {
  value?: boolean;
  onValueChanged?: (e: { value: boolean }) => void;
  disabled?: boolean;
  text?: string;
  [key: string]: unknown;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={!!value}
        disabled={disabled}
        onChange={(e) => onValueChanged?.({ value: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 accent-[#2f6fd0] disabled:opacity-50"
      />
      {text ? <span className="text-[13px] text-slate-700">{text}</span> : null}
    </label>
  );
}

export default CheckBox;
