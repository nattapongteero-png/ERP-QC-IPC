import * as React from 'react';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';

/**
 * Demo stand-in for the DevExtreme button.
 *
 * Icon-only when there is no text — the back arrow and the row actions — and a
 * proper labelled button otherwise, since a text button squeezed into a 36px
 * square wraps its label down the page.
 */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  back: ArrowLeft,
  add: Plus,
  plus: Plus,
  edit: Pencil,
  trash: Trash2,
};

export function DxButton({
  icon,
  onClick,
  text,
  type,
  disabled,
}: {
  icon?: string;
  type?: string;
  stylingMode?: string;
  text?: string;
  disabled?: boolean;
  onClick?: () => void;
  [key: string]: unknown;
}) {
  const Icon = icon ? ICONS[icon] : undefined;

  if (!text) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={icon ?? 'button'}
        className="dx-button flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
      >
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </button>
    );
  }

  const filled = type === 'default' || type === 'success';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'dx-button inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition disabled:opacity-50 ' +
        (filled
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border border-slate-200 text-slate-700 hover:bg-slate-50')
      }
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {text}
    </button>
  );
}

export default DxButton;
