/**
 * Export a DevExtreme DataGrid to a real .xlsx file (client-side).
 *
 * DevExtreme's `<Export enabled />` only renders the toolbar button — on its own
 * it does NOT produce a file in this app (no default onExporting wiring), so
 * clicking it appeared to do nothing. This helper does the actual work with
 * exceljs + file-saver and is shared by every grid that offers Excel export so
 * the behaviour (and file naming) stays identical everywhere.
 *
 * Usage:
 *   const gridRef = useRef<DataGridRef>(null);
 *   const onExport = () => exportGridToExcel(gridRef.current, 'ar-invoices', 'ใบแจ้งหนี้');
 *   ...
 *   <Button icon="xlsxfile" text="ส่งออก Excel" onClick={onExport} />
 *   <DataGrid ref={gridRef} ...>
 */

import { exportDataGrid } from 'devextreme/excel_exporter';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import type { DataGridRef } from 'devextreme-react/data-grid';

/**
 * @param gridRef      the DataGrid ref (`gridRef.current`)
 * @param fileBaseName base file name; the date is appended → `<base>-YYYY-MM-DD.xlsx`
 * @param worksheetName sheet tab name (defaults to the file base name)
 */
export async function exportGridToExcel(
  gridRef: DataGridRef | null,
  fileBaseName: string,
  worksheetName?: string,
): Promise<void> {
  if (!gridRef) return;
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(worksheetName || fileBaseName);
  await exportDataGrid({
    component: gridRef.instance(),
    worksheet,
    autoFilterEnabled: true,
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  saveAs(
    new Blob([buffer], { type: 'application/octet-stream' }),
    `${fileBaseName}-${date}.xlsx`,
  );
}
