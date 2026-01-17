import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Extend jsPDF types for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
  }
}

interface AutoTableOptions {
  head: string[][];
  body: (string | number)[][];
  startY?: number;
  theme?: string;
  headStyles?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface ExportColumn {
  key: string;
  label: string;
  labelTh?: string;
  format?: 'currency' | 'percent' | 'number' | 'text';
}

export interface ExportOptions {
  filename: string;
  title: string;
  titleTh?: string;
  subtitle?: string;
  language?: 'en' | 'th';
  companyName?: string;
  asOfDate?: string;
  periodStart?: string;
  periodEnd?: string;
}

/**
 * Format report data for export by mapping keys to labels
 */
export function formatReportDataForExport<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[]
): Record<string, unknown>[] {
  return data.map(row => {
    const formattedRow: Record<string, unknown> = {};
    columns.forEach(col => {
      formattedRow[col.label] = row[col.key];
    });
    return formattedRow;
  });
}

/**
 * Export data to CSV with UTF-8 BOM for Thai character support
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options?: ExportOptions
): string {
  const headers = columns.map(c => options?.language === 'th' && c.labelTh ? c.labelTh : c.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return String(value);
    })
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return '\uFEFF' + csv; // Add UTF-8 BOM for Excel Thai support
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data to Excel with formatting
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const formattedData = formatReportDataForExport(data, columns);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();

  // Add metadata
  workbook.Props = {
    Title: options.title,
    Author: options.companyName || 'Herbal Medicine ERP',
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, options.title.substring(0, 31));
  XLSX.writeFile(workbook, `${options.filename}.xlsx`);
}

/**
 * Export data to PDF with company header and formatting
 */
export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options: ExportOptions
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  const title = options.language === 'th' && options.titleTh ? options.titleTh : options.title;
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  if (options.companyName) {
    doc.setFontSize(10);
    doc.text(options.companyName, 14, 22);
  }

  if (options.asOfDate) {
    doc.setFontSize(10);
    doc.text(`As of: ${options.asOfDate}`, 14, 28);
  } else if (options.periodStart && options.periodEnd) {
    doc.setFontSize(10);
    doc.text(`Period: ${options.periodStart} - ${options.periodEnd}`, 14, 28);
  }

  // Table
  const headers = columns.map(c => options.language === 'th' && c.labelTh ? c.labelTh : c.label);
  const body = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (col.format === 'currency' && typeof value === 'number') {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(value);
      }
      if (col.format === 'percent' && typeof value === 'number') {
        return `${value.toFixed(2)}%`;
      }
      return String(value);
    })
  );

  doc.autoTable({
    head: [headers],
    body,
    startY: 35,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { top: 35 },
  });

  doc.save(`${options.filename}.pdf`);
}
