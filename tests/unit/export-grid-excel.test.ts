/**
 * Unit test for exportGridToExcel — proves the helper actually drives the
 * exceljs/file-saver pipeline (the thing DevExtreme's bare <Export enabled />
 * was NOT doing, so clicking the old button produced no file).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the three external pieces the helper orchestrates.
const exportDataGridMock = vi.fn().mockResolvedValue(undefined);
const saveAsMock = vi.fn();
const writeBufferMock = vi.fn().mockResolvedValue(new ArrayBuffer(8));
const addWorksheetMock = vi.fn().mockReturnValue({ name: 'ws' });

vi.mock('devextreme/excel_exporter', () => ({
  exportDataGrid: (...args: unknown[]) => exportDataGridMock(...args),
}));
vi.mock('exceljs', () => ({
  Workbook: class {
    xlsx = { writeBuffer: writeBufferMock };
    addWorksheet = addWorksheetMock;
  },
}));
vi.mock('file-saver', () => ({
  saveAs: (...args: unknown[]) => saveAsMock(...args),
}));

import { exportGridToExcel } from '@/lib/utils/export-grid-excel';

describe('exportGridToExcel', () => {
  beforeEach(() => {
    exportDataGridMock.mockClear();
    saveAsMock.mockClear();
    writeBufferMock.mockClear();
    addWorksheetMock.mockClear();
  });

  it('does nothing when the grid ref is null (no crash)', async () => {
    await exportGridToExcel(null, 'ar-invoices');
    expect(exportDataGridMock).not.toHaveBeenCalled();
    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it('exports the grid and saves a dated .xlsx file', async () => {
    const fakeInstance = { id: 'grid' };
    const fakeRef = { instance: () => fakeInstance } as any;

    await exportGridToExcel(fakeRef, 'ar-invoices', 'ใบแจ้งหนี้');

    // 1) worksheet named after the provided sheet name
    expect(addWorksheetMock).toHaveBeenCalledWith('ใบแจ้งหนี้');
    // 2) DevExtreme export ran against the grid instance
    expect(exportDataGridMock).toHaveBeenCalledTimes(1);
    const arg = exportDataGridMock.mock.calls[0][0];
    expect(arg.component).toBe(fakeInstance);
    // 3) a file was actually saved, name starts with the base + is an .xlsx
    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const fileName = saveAsMock.mock.calls[0][1] as string;
    expect(fileName).toMatch(/^ar-invoices-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('defaults the worksheet name to the file base name', async () => {
    const fakeRef = { instance: () => ({}) } as any;
    await exportGridToExcel(fakeRef, 'tax-invoices');
    expect(addWorksheetMock).toHaveBeenCalledWith('tax-invoices');
  });
});
