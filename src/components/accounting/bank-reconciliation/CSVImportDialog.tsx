/**
 * CSV Import Dialog Component (T070)
 * Handles CSV file upload and column mapping for bank statement import
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { CheckBox } from 'devextreme-react/check-box';
import { TextBox } from 'devextreme-react/text-box';
import DataGrid, { Column } from 'devextreme-react/data-grid';

interface CSVImportDialogProps {
  visible: boolean;
  onClose: () => void;
  onImport: (lines: any[]) => Promise<void>;
}

interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  debitColumn: string;
  creditColumn: string;
  referenceColumn: string;
  balanceColumn: string;
}

const dateFormats = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (ไทย)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (สหรัฐฯ)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
];

export function CSVImportDialog({
  visible,
  onClose,
  onImport,
}: CSVImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateColumn: '',
    descriptionColumn: '',
    debitColumn: '',
    creditColumn: '',
    referenceColumn: '',
    balanceColumn: '',
  });
  const [parsedLines, setParsedLines] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    return lines.map((line) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);

      if (data.length > 0) {
        setCsvData(data);
        setHeaders(data[0]);
        setStep('mapping');
      }
    };
    reader.readAsText(file);
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return '';

    const cleaned = dateStr.trim();
    let day = 1, month = 1, year = 2024;

    try {
      if (dateFormat === 'DD/MM/YYYY') {
        const parts = cleaned.split('/');
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else if (dateFormat === 'YYYY-MM-DD') {
        const parts = cleaned.split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else if (dateFormat === 'MM/DD/YYYY') {
        const parts = cleaned.split('/');
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else if (dateFormat === 'DD-MM-YYYY') {
        const parts = cleaned.split('-');
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }

      if (year < 100) year += 2000;
      if (year > 2500) year -= 543; // Convert Buddhist year

      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const parseAmount = (str: string): number | undefined => {
    if (!str) return undefined;
    const cleaned = str.replace(/[,\s]/g, '').replace(/[()]/g, '-');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : Math.abs(num);
  };

  const handleMapping = () => {
    const startRow = hasHeader ? 1 : 0;
    const dataRows = csvData.slice(startRow);
    const columnNames = hasHeader ? headers : headers.map((_, i) => `Column ${i + 1}`);

    const dateIdx = columnNames.indexOf(mapping.dateColumn);
    const descIdx = columnNames.indexOf(mapping.descriptionColumn);
    const debitIdx = mapping.debitColumn ? columnNames.indexOf(mapping.debitColumn) : -1;
    const creditIdx = mapping.creditColumn ? columnNames.indexOf(mapping.creditColumn) : -1;
    const refIdx = mapping.referenceColumn ? columnNames.indexOf(mapping.referenceColumn) : -1;
    const balIdx = mapping.balanceColumn ? columnNames.indexOf(mapping.balanceColumn) : -1;

    const lines = dataRows.map((row, idx) => ({
      rowNumber: idx + 1,
      transactionDate: parseDate(row[dateIdx] || ''),
      description: row[descIdx] || '',
      debitAmount: debitIdx >= 0 ? parseAmount(row[debitIdx]) : undefined,
      creditAmount: creditIdx >= 0 ? parseAmount(row[creditIdx]) : undefined,
      reference: refIdx >= 0 ? row[refIdx] : undefined,
      balance: balIdx >= 0 ? parseAmount(row[balIdx]) : undefined,
    })).filter(line => line.transactionDate && line.description);

    setParsedLines(lines);
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport(parsedLines);
      handleClose();
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setCsvData([]);
    setHeaders([]);
    setParsedLines([]);
    setMapping({
      dateColumn: '',
      descriptionColumn: '',
      debitColumn: '',
      creditColumn: '',
      referenceColumn: '',
      balanceColumn: '',
    });
    onClose();
  };

  const columnOptions = hasHeader
    ? headers.map((h) => ({ value: h, label: h }))
    : headers.map((_, i) => ({ value: `Column ${i + 1}`, label: `Column ${i + 1}` }));

  return (
    <Popup
      visible={visible}
      onHiding={handleClose}
      title="นำเข้ารายการเดินบัญชีธนาคาร"
      width={800}
      height={600}
      showCloseButton={true}
      data-testid="csv-import-dialog"
    >
      <div className="p-4 h-full flex flex-col">
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                อัปโหลดไฟล์ CSV รายการเดินบัญชี
              </h3>
              <p className="text-sm text-gray-500">
                เลือกไฟล์ CSV ที่ส่งออกจากธนาคารของคุณ
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              data-testid="csv-file-input"
            />
            <Button
              text="เลือกไฟล์ CSV"
              icon="upload"
              type="default"
              stylingMode="contained"
              onClick={() => fileInputRef.current?.click()}
              data-testid="select-file-btn"
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                จับคู่คอลัมน์ CSV
              </h3>
              <p className="text-sm text-gray-500">
                จับคู่คอลัมน์ในไฟล์ CSV กับฟิลด์ที่ต้องการ
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckBox
                  value={hasHeader}
                  onValueChanged={(e) => setHasHeader(e.value)}
                />
                <span className="text-sm">แถวแรกเป็นหัวคอลัมน์</span>
              </div>
              <div>
                <label className="text-sm font-medium">รูปแบบวันที่</label>
                <SelectBox
                  items={dateFormats}
                  value={dateFormat}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setDateFormat(e.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-red-600">คอลัมน์วันที่ *</label>
                <SelectBox
                  items={columnOptions}
                  value={mapping.dateColumn}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setMapping({ ...mapping, dateColumn: e.value })}
                  placeholder="เลือกคอลัมน์วันที่"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-red-600">คอลัมน์รายละเอียด *</label>
                <SelectBox
                  items={columnOptions}
                  value={mapping.descriptionColumn}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setMapping({ ...mapping, descriptionColumn: e.value })}
                  placeholder="เลือกคอลัมน์รายละเอียด"
                />
              </div>
              <div>
                <label className="text-sm font-medium">คอลัมน์ยอดเดบิต</label>
                <SelectBox
                  items={columnOptions}
                  value={mapping.debitColumn}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setMapping({ ...mapping, debitColumn: e.value })}
                  placeholder="เลือกคอลัมน์เดบิต"
                  showClearButton={true}
                />
              </div>
              <div>
                <label className="text-sm font-medium">คอลัมน์ยอดเครดิต</label>
                <SelectBox
                  items={columnOptions}
                  value={mapping.creditColumn}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setMapping({ ...mapping, creditColumn: e.value })}
                  placeholder="เลือกคอลัมน์เครดิต"
                  showClearButton={true}
                />
              </div>
              <div>
                <label className="text-sm font-medium">คอลัมน์อ้างอิง</label>
                <SelectBox
                  items={columnOptions}
                  value={mapping.referenceColumn}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setMapping({ ...mapping, referenceColumn: e.value })}
                  placeholder="เลือกคอลัมน์อ้างอิง"
                  showClearButton={true}
                />
              </div>
              <div>
                <label className="text-sm font-medium">คอลัมน์ยอดคงเหลือ</label>
                <SelectBox
                  items={columnOptions}
                  value={mapping.balanceColumn}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => setMapping({ ...mapping, balanceColumn: e.value })}
                  placeholder="เลือกคอลัมน์ยอดคงเหลือ"
                  showClearButton={true}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left">
                        {hasHeader ? h : `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(hasHeader ? 1 : 0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button text="ย้อนกลับ" onClick={() => setStep('upload')} />
              <Button
                text="ถัดไป"
                type="default"
                stylingMode="contained"
                onClick={handleMapping}
                disabled={!mapping.dateColumn || !mapping.descriptionColumn}
              />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ตรวจสอบก่อนนำเข้า
              </h3>
              <p className="text-sm text-gray-500">
                {parsedLines.length} รายการพร้อมนำเข้า
              </p>
            </div>

            <div className="flex-1 overflow-auto">
              <DataGrid
                dataSource={parsedLines}
                keyExpr="rowNumber"
                showBorders={true}
                height={350}
              >
                <Column dataField="rowNumber" caption="#" width={50} />
                <Column dataField="transactionDate" caption="วันที่" width={100} />
                <Column dataField="description" caption="รายละเอียด" />
                <Column dataField="debitAmount" caption="เดบิต" width={100} format="fixedPoint" />
                <Column dataField="creditAmount" caption="เครดิต" width={100} format="fixedPoint" />
                <Column dataField="reference" caption="อ้างอิง" width={120} />
                <Column dataField="balance" caption="ยอดคงเหลือ" width={100} format="fixedPoint" />
              </DataGrid>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button text="ย้อนกลับ" onClick={() => setStep('mapping')} />
              <Button
                text={importing ? 'กำลังนำเข้า...' : 'นำเข้า'}
                type="success"
                stylingMode="contained"
                onClick={handleImport}
                disabled={importing || parsedLines.length === 0}
                data-testid="import-btn"
              />
            </div>
          </div>
        )}
      </div>
    </Popup>
  );
}
