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

export function DxDataGrid({
  dataSource = [],
  columns = [],
  onRowClick,
}: {
  dataSource?: Record<string, unknown>[];
  columns?: DxDataGridColumn[];
  keyExpr?: string;
  onRowClick?: (e: { data: Record<string, unknown> }) => void;
  [key: string]: unknown;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-[#fbfbfb] text-left">
            {columns.map((c, i) => (
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
              {columns.map((c, i) => (
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
