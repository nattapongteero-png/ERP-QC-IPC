import * as React from 'react';

/**
 * Demo stand-in for DxTabs (DevExtreme Tabs).
 *
 * The item-search dialog switches its list between item types with these.
 * Only the props that dialog passes are honoured: the item list, the selected
 * index and the change callback.
 */
export interface DxTabItemData {
  id?: number;
  text: string;
  icon?: string;
  disabled?: boolean;
  badge?: string | number;
  visible?: boolean;
}
export type DxTabItem = DxTabItemData;

export function DxTabItemComponent(): null {
  return null;
}

export function DxTabs({
  items = [],
  selectedIndex = 0,
  onSelectedIndexChange,
  className = '',
}: {
  items?: DxTabItemData[];
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  className?: string;
  [key: string]: unknown;
}) {
  const shown = items.filter((it) => it.visible !== false);
  return (
    <div className={`flex flex-wrap items-center gap-1 border-b border-slate-200 ${className}`}>
      {shown.map((it, i) => (
        <button
          key={it.id ?? i}
          type="button"
          disabled={it.disabled}
          onClick={() => onSelectedIndexChange?.(items.indexOf(it))}
          className={
            'relative -mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition disabled:opacity-40 ' +
            (items.indexOf(it) === selectedIndex
              ? 'border-[#2f6fd0] text-[#2f6fd0]'
              : 'border-transparent text-slate-600 hover:text-slate-900')
          }
        >
          {it.text}
          {it.badge != null && it.badge !== '' ? (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
              {it.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default DxTabs;
