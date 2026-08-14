import * as React from 'react';
import { ArrowLeft } from 'lucide-react';

/** Demo stand-in for the DevExtreme button — only the back arrow is used here. */
export function DxButton({
  icon,
  onClick,
  text,
}: {
  icon?: string;
  type?: string;
  stylingMode?: string;
  text?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={text ?? icon ?? 'button'}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
    >
      {icon === 'back' ? <ArrowLeft className="h-5 w-5" /> : text}
    </button>
  );
}

export default DxButton;
