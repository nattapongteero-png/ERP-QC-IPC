import { describe, it, expect, vi } from 'vitest';

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
    autoTable: vi.fn(),
  })),
}));

// Mock xlsx
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn().mockReturnValue({}),
    book_new: vi.fn().mockReturnValue({ SheetNames: [], Sheets: {}, Props: {} }),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

import { exportToCSV, formatReportDataForExport } from '@/lib/services/report-export.service';

describe('Report Export Service', () => {
  it('formats report data for export', () => {
    const data = [
      { accountCode: '1110', accountName: 'Cash', debit: 100000, credit: 0 },
      { accountCode: '2110', accountName: 'AP', debit: 0, credit: 50000 },
    ];
    const columns = [
      { key: 'accountCode', label: 'Account Code' },
      { key: 'accountName', label: 'Account Name' },
      { key: 'debit', label: 'Debit' },
      { key: 'credit', label: 'Credit' },
    ];

    const result = formatReportDataForExport(data, columns);
    expect(result).toHaveLength(2);
    expect(result[0]['Account Code']).toBe('1110');
    expect(result[0]['Debit']).toBe(100000);
  });

  it('exports to CSV with Thai character support', () => {
    const data = [{ name: 'เงินสด', amount: 100000 }];
    const csv = exportToCSV(data, [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount' },
    ]);
    expect(csv).toContain('Name,Amount');
    expect(csv).toContain('เงินสด');
    expect(csv).toContain('100000');
    // Check UTF-8 BOM is present
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('exports to CSV with Thai labels when language is th', () => {
    const data = [{ name: 'Cash', amount: 100000 }];
    const csv = exportToCSV(
      data,
      [
        { key: 'name', label: 'Name', labelTh: 'ชื่อ' },
        { key: 'amount', label: 'Amount', labelTh: 'จำนวนเงิน' },
      ],
      { filename: 'test', title: 'Test', language: 'th' }
    );
    expect(csv).toContain('ชื่อ,จำนวนเงิน');
  });

  it('handles null and undefined values in CSV', () => {
    const data = [{ name: null, amount: undefined }];
    const csv = exportToCSV(data, [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount' },
    ]);
    expect(csv).toContain('Name,Amount');
    expect(csv).toContain(','); // Both values should be empty
  });

  it('escapes commas in CSV values', () => {
    const data = [{ name: 'Smith, John', amount: 100000 }];
    const csv = exportToCSV(data, [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount' },
    ]);
    expect(csv).toContain('"Smith, John"');
  });
});
