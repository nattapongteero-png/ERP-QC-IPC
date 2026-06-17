'use client';

/**
 * DocumentViewer Component
 *
 * Renders inline previews for various document types:
 * - PDF: Native iframe viewer
 * - DOCX: Converted to HTML using mammoth.js
 * - XLSX/XLS: Converted to HTML table using SheetJS
 * - DOC: Not supported (legacy format)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  Table,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
  className?: string;
}

type FileType = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'unknown';

interface SheetData {
  name: string;
  html: string;
}

function getFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'doc':
      return 'doc';
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    default:
      return 'unknown';
  }
}

export function DocumentViewer({ fileUrl, fileName, className = '' }: DocumentViewerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordContent, setWordContent] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  const fileType = getFileType(fileName);

  // Load Word document
  const loadWordDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch document');

      const arrayBuffer = await response.arrayBuffer();
      const mammoth = await import('mammoth');

      const result = await mammoth.convertToHtml({ arrayBuffer });
      setWordContent(result.value);

      if (result.messages.length > 0) {
        console.log('Mammoth conversion messages:', result.messages);
      }
    } catch (err) {
      console.error('Error loading Word document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [fileUrl]);

  // Load Excel document
  const loadExcelDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch spreadsheet');

      const arrayBuffer = await response.arrayBuffer();
      const XLSX = await import('xlsx');

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const sheets: SheetData[] = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const html = XLSX.utils.sheet_to_html(worksheet, {
          id: `sheet-${sheetName}`,
          editable: false,
        });
        return { name: sheetName, html };
      });

      setExcelSheets(sheets);
      setActiveSheet(0);
    } catch (err) {
      console.error('Error loading Excel document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheet');
    } finally {
      setLoading(false);
    }
  }, [fileUrl]);

  // Load document based on type
  useEffect(() => {
    if (fileType === 'docx') {
      loadWordDocument();
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      loadExcelDocument();
    }
  }, [fileType, loadWordDocument, loadExcelDocument]);

  // PDF Viewer.
  // `fileUrl` may already carry a query string (callers commonly pass
  // `.../download?inline=1`). Append `inline=1` with the correct separator so we
  // never produce a broken `...?inline=1?inline=1` URL — that yields a blank
  // iframe. Also force a real height: an iframe with no height collapses to 0,
  // showing an empty dialog even when the PDF loaded fine.
  if (fileType === 'pdf') {
    const sep = fileUrl.includes('?') ? '&' : '?';
    const src = fileUrl.includes('inline=1') ? fileUrl : `${fileUrl}${sep}inline=1`;
    return (
      <iframe
        src={src}
        className={`w-full h-full min-h-[70vh] bg-slate-100 dark:bg-slate-900 ${className}`}
        title={`Preview: ${fileName}`}
      />
    );
  }

  // Word Document Viewer
  if (fileType === 'docx') {
    if (loading) {
      return (
        <div className={`flex flex-col items-center justify-center bg-white dark:bg-slate-900 ${className}`}>
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={`flex flex-col items-center justify-center bg-white dark:bg-slate-900 ${className}`}>
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Failed to Load Document</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">{error}</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
          >
            <Download className="h-4 w-4" />
            Download Instead
          </a>
        </div>
      );
    }

    if (wordContent) {
      return (
        <div className={`bg-white dark:bg-slate-900 overflow-auto ${className}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Word Document Preview
            </span>
          </div>
          <div
            className="prose prose-sm max-w-none dark:prose-invert p-8
                       prose-headings:text-foreground prose-p:text-foreground
                       prose-table:border prose-table:border-slate-300 dark:prose-table:border-slate-600
                       prose-td:border prose-td:border-slate-300 dark:prose-td:border-slate-600 prose-td:p-2
                       prose-th:border prose-th:border-slate-300 dark:prose-th:border-slate-600 prose-th:p-2 prose-th:bg-slate-100 dark:prose-th:bg-slate-800"
            dangerouslySetInnerHTML={{ __html: wordContent }}
          />
        </div>
      );
    }

    return null;
  }

  // Excel Viewer
  if (fileType === 'xlsx' || fileType === 'xls') {
    if (loading) {
      return (
        <div className={`flex flex-col items-center justify-center bg-white dark:bg-slate-900 ${className}`}>
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading spreadsheet...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={`flex flex-col items-center justify-center bg-white dark:bg-slate-900 ${className}`}>
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Failed to Load Spreadsheet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">{error}</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
          >
            <Download className="h-4 w-4" />
            Download Instead
          </a>
        </div>
      );
    }

    if (excelSheets.length > 0) {
      return (
        <div className={`bg-white dark:bg-slate-900 flex flex-col ${className}`}>
          {/* Header with sheet tabs */}
          <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Excel Spreadsheet Preview
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto">
                {excelSheets.length} sheet{excelSheets.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Sheet Tabs */}
            {excelSheets.length > 1 && (
              <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 px-2">
                <button
                  onClick={() => setActiveSheet(Math.max(0, activeSheet - 1))}
                  disabled={activeSheet === 0}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 overflow-x-auto flex gap-1 py-2 px-1">
                  {excelSheets.map((sheet, index) => (
                    <button
                      key={sheet.name}
                      onClick={() => setActiveSheet(index)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                        activeSheet === index
                          ? 'bg-white dark:bg-slate-700 text-primary shadow-sm border border-slate-200 dark:border-slate-600'
                          : 'text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Table className="h-3.5 w-3.5" />
                      {sheet.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActiveSheet(Math.min(excelSheets.length - 1, activeSheet + 1))}
                  disabled={activeSheet === excelSheets.length - 1}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Sheet Content */}
          <div className="flex-1 overflow-auto">
            <div
              className="excel-viewer p-4"
              dangerouslySetInnerHTML={{ __html: excelSheets[activeSheet]?.html || '' }}
            />
          </div>

          {/* Excel Table Styles */}
          <style jsx global>{`
            .excel-viewer table {
              border-collapse: collapse;
              width: 100%;
              font-size: 13px;
            }
            .excel-viewer th,
            .excel-viewer td {
              border: 1px solid #e2e8f0;
              padding: 8px 12px;
              text-align: left;
              white-space: nowrap;
            }
            .excel-viewer th {
              background-color: #f1f5f9;
              font-weight: 600;
              position: sticky;
              top: 0;
            }
            .excel-viewer tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .excel-viewer tr:hover {
              background-color: #e2e8f0;
            }
            .dark .excel-viewer th,
            .dark .excel-viewer td {
              border-color: #475569;
            }
            .dark .excel-viewer th {
              background-color: #334155;
            }
            .dark .excel-viewer tr:nth-child(even) {
              background-color: #1e293b;
            }
            .dark .excel-viewer tr:hover {
              background-color: #334155;
            }
          `}</style>
        </div>
      );
    }

    return null;
  }

  // Legacy .doc format - not supported
  if (fileType === 'doc') {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 ${className}`}>
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-6">
          <FileText className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Legacy Format</h3>
        <p className="text-muted-foreground text-center max-w-md mb-2">
          The .doc format (Microsoft Word 97-2003) cannot be previewed in the browser.
        </p>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Please download the file or consider converting it to .docx format.
        </p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Download className="h-5 w-5" />
          Download File
        </a>
      </div>
    );
  }

  // Unknown file type
  return (
    <div className={`flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 ${className}`}>
      <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Preview Not Available</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        This file type cannot be previewed in the browser.
      </p>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
      >
        <Download className="h-5 w-5" />
        Download File
      </a>
    </div>
  );
}

export default DocumentViewer;
