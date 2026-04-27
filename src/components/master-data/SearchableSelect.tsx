'use client';

/**
 * SearchableSelect — drop-down picker matching the IPC criteria prototype.
 *
 * Reference: https://oommiemie.github.io/ipc-criteria-prototype/
 *
 * Behaviours:
 *  - Click trigger to open a panel below it
 *  - Type-ahead search filters options by label
 *  - Search highlights matching text in yellow
 *  - Arrow keys navigate, Enter selects, Esc closes
 *  - Optional "+ เพิ่มตัวเลือกใหม่..." footer when onAddNew is provided
 *  - Outside-click closes; selected value gets emerald background + checkmark
 */

import * as React from 'react';
import { ChevronDown, Search, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Marks user-added options with a sparkle icon */
  custom?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  /** Optional handler invoked when user clicks the "add new" footer */
  onAddNew?: (searchText: string) => void;
  addNewLabel?: string;
  className?: string;
  /** Show clear (×) button when something is selected */
  showClear?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  onAddNew,
  addNewLabel = '＋ เพิ่มตัวเลือกใหม่...',
  className,
  showClear = true,
  disabled = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [hoveredIdx, setHoveredIdx] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  React.useEffect(() => {
    setHoveredIdx(0);
  }, [search]);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[hoveredIdx]) select(filtered[hoveredIdx].value);
    }
  };

  const highlight = (text: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-yellow-100 text-slate-900 font-semibold rounded px-0.5">
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-white text-sm transition outline-none',
          'flex items-center justify-between cursor-pointer',
          'hover:border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15',
          selected ? 'text-slate-900' : 'text-slate-400',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'border-emerald-500 ring-2 ring-emerald-500/15',
        )}
      >
        <span className="truncate text-left flex-1">
          {selected ? (
            <>
              {selected.label}
              {selected.custom && <span className="ml-1">✨</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {showClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="text-slate-400 hover:text-slate-600 px-1 text-base leading-none"
              aria-label="Clear selection"
            >
              ×
            </span>
          )}
          <ChevronDown
            className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKey}
                placeholder="พิมพ์เพื่อค้นหา..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                ไม่พบตัวเลือกที่ตรงกับ &quot;
                <span className="font-medium text-slate-600">{search}</span>
                &quot;
              </div>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  onMouseEnter={() => setHoveredIdx(i)}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors',
                    o.value === value
                      ? 'bg-emerald-50 text-emerald-800 font-medium'
                      : i === hoveredIdx
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span className="truncate">
                    {highlight(o.label)}
                    {o.custom && <span className="ml-1">✨</span>}
                  </span>
                  {o.value === value && <Check className="w-4 h-4 text-emerald-600 ml-2 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>

          {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearch('');
                onAddNew(search);
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 border-t border-emerald-200 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>
                {addNewLabel}
                {search && (
                  <span className="text-slate-500 font-normal"> (&quot;{search}&quot;)</span>
                )}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
