'use client';

/**
 * Hover / focus tooltip on an info icon.
 *
 * The bubble is portalled to <body> and positioned in viewport coordinates.
 * As a plain absolute child it was clipped the moment an ancestor scrolled —
 * inside a dialog's scrolling band the whole tip disappeared behind the edge —
 * and `overflow` cannot be relaxed on an ancestor that has to scroll.
 *
 * `group-focus-within` gives keyboard users what hover gives mouse users.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert } from 'lucide-react';

const WIDTH = 256;

export function InfoTip({ text, testId }: { text: string; testId: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Kept inside the window: centred under the icon, then pulled back from
    // whichever edge it would otherwise cross.
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - WIDTH / 2),
      window.innerWidth - WIDTH - 8,
    );
    setPos({ top: r.bottom + 8, left });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      className="inline-flex shrink-0"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        aria-label={text}
        data-testid={testId}
        className="flex h-4 w-4 items-center justify-center rounded-full text-[#bfbfbf] transition-colors hover:text-[#5682e9] focus-visible:text-[#5682e9]"
      >
        <CircleAlert className="h-4 w-4" />
      </button>
      {pos !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            data-testid={`${testId}-bubble`}
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="pointer-events-none fixed z-[2000] rounded-[12px] bg-[#1a1d21] px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

export default InfoTip;
