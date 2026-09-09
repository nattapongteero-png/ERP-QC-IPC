import * as React from 'react';

/**
 * Demo stand-in for DxDataGrid (DevExtreme DataGrid).
 *
 * DevExtreme cannot be redistributed, so the public demo renders a plain
 * table. It honours the props the QC screens actually pass — `columns` with
 * `caption` / `dataField` / `cellRender` / `width`, and `onRowClick` — and
 * drops the paging, grouping and sorting chrome, which are not what the demo
 * is showing off.
 */
export interface DxDataGridColumn {
  dataField?: string;
  caption?: string;
  width?: number | string;
  cellRender?: (cell: { data: Record<string, unknown>; value: unknown }) => React.ReactNode;
  [key: string]: unknown;
}

/**
 * A real DevExtreme grid can be configured two ways: a `columns` prop, or
 * `<Column>` children. The work order screens use the prop; the item-search
 * dialog uses children. These render nothing themselves — they are read back
 * off the children below — and the rest are configuration the plain table has
 * no equivalent for.
 */
export function DxColumn(_props: DxDataGridColumn): null {
  return null;
}
DxColumn.isDxColumn = true as const;

export function DxSelection(_props: { mode?: string; [key: string]: unknown }): null {
  return null;
}
export function DxScrolling(_props: { mode?: string; [key: string]: unknown }): null {
  return null;
}
export function DxPaging(_props: { pageSize?: number; [key: string]: unknown }): null {
  return null;
}

function columnsFromChildren(children: React.ReactNode): DxDataGridColumn[] {
  const found: DxDataGridColumn[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && (child.type as { isDxColumn?: boolean })?.isDxColumn) {
      found.push(child.props as DxDataGridColumn);
    }
  });
  return found;
}

export function DxDataGrid({
  dataSource = [],
  columns,
  children,
  onRowClick,
}: {
  dataSource?: Record<string, unknown>[];
  columns?: DxDataGridColumn[];
  children?: React.ReactNode;
  keyExpr?: string;
  onRowClick?: (e: { data: Record<string, unknown> }) => void;
  [key: string]: unknown;
}) {
  const cols = columns?.length ? columns : columnsFromChildren(children);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-[#fbfbfb] text-left">
            {cols.map((c, i) => (
              <th
                key={i}
                style={{ width: c.width }}
                className="px-3 py-2.5 text-[12px] font-semibold text-slate-600"
              >
                {c.caption}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.map((row, r) => (
            <tr
              key={r}
              onClick={() => onRowClick?.({ data: row })}
              className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
            >
              {cols.map((c, i) => (
                <td key={i} className="px-3 py-2.5 align-middle text-slate-800">
                  {c.cellRender
                    ? c.cellRender({ data: row, value: c.dataField ? row[c.dataField] : undefined })
                    : String(c.dataField ? (row[c.dataField] ?? '') : '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DxDataGrid;
