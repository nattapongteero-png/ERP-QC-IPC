'use client';

import { FileText, FileSpreadsheet, FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ReportToolbarProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
  disabled?: boolean;
}

export function ReportToolbar({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  onPrint,
  disabled,
}: ReportToolbarProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onExportPDF}
        disabled={disabled}
        data-testid="export-pdf"
        className="gap-2"
      >
        <FileText className="h-4 w-4 text-red-500" />
        PDF
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onExportExcel}
        disabled={disabled}
        data-testid="export-excel"
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4 text-green-600" />
        Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onExportCSV}
        disabled={disabled}
        data-testid="export-csv"
        className="gap-2"
      >
        <FileDown className="h-4 w-4 text-blue-500" />
        CSV
      </Button>

      <div className="border-l border-gray-200 h-6 mx-2" />

      <Button
        variant="outline"
        size="sm"
        onClick={onPrint}
        disabled={disabled}
        data-testid="print-button"
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        Print
      </Button>
    </div>
  );
}
