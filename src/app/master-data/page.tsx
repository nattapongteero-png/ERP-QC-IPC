'use client';

/**
 * Master Data Index Page
 * Dashboard for accessing all master data management pages.
 * Admin-only: Excel template download & import for all master data types.
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Database,
  Building2,
  Wrench,
  Thermometer,
  FileText,
  Scale,
  FlaskConical,
  ChevronRight,
  Download,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

// ─── Master data module definitions ───────────────────────────────────
const masterDataModules = [
  { key: 'productionRooms', href: '/master-data/production-rooms', icon: Building2, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'productionEquipment', href: '/master-data/production-equipment', icon: Wrench, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  { key: 'environmentalConditions', href: '/master-data/environmental-conditions', icon: Thermometer, iconBgColor: 'bg-teal-100', iconColor: 'text-teal-600' },
  { key: 'sopTemplates', href: '/master-data/sop-templates', icon: FileText, iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  { key: 'packagingQCCriteria', href: '/master-data/packaging-qc-criteria', icon: Scale, iconBgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  { key: 'ipcCriteria', href: '/master-data/ipc-criteria', icon: FlaskConical, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
];

// ─── Import config per module ─────────────────────────────────────────
interface ImportConfig {
  label: string;
  apiUrl: string;
  templateFileName: string;
  columns: { header: string; field: string; required: boolean; note?: string }[];
  validValues?: Record<string, string[]>;
  exampleRows: Record<string, string | number>[];
}

const IMPORT_CONFIGS: Record<string, ImportConfig> = {
  productionRooms: {
    label: 'Production Rooms (ห้องผลิต)',
    apiUrl: '/api/master-data/production-rooms',
    templateFileName: 'Template_Production_Rooms.xlsx',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'ประเภท (Room Type)*', field: 'roomType', required: true, note: 'weighing, mixing, packaging, storage, preparation, production' },
      { header: 'รายละเอียด (Description)', field: 'description', required: false },
    ],
    validValues: { roomType: ['weighing', 'mixing', 'packaging', 'storage', 'preparation', 'production'] },
    exampleRows: [
      { 'รหัส (Code)*': 'ROOM-001', 'ชื่อ EN (Name)*': 'Weighing Room 1', 'ชื่อ TH (Name TH)*': 'ห้องชั่งยา 1', 'ประเภท (Room Type)*': 'weighing', 'รายละเอียด (Description)': 'ห้องชั่งวัตถุดิบ ชั้น 2' },
    ],
  },
  productionEquipment: {
    label: 'Production Equipment (อุปกรณ์)',
    apiUrl: '/api/master-data/production-equipment',
    templateFileName: 'Template_Production_Equipment.xlsx',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'ประเภท (Equipment Type)*', field: 'equipmentType', required: true, note: 'scale, mixer, hotplate, container, tool, filler' },
      { header: 'ขนาด/ความจุ (Capacity)', field: 'capacity', required: false },
      { header: 'รายละเอียด (Description)', field: 'description', required: false },
    ],
    validValues: { equipmentType: ['scale', 'mixer', 'hotplate', 'container', 'tool', 'filler'] },
    exampleRows: [
      { 'รหัส (Code)*': 'EQ-001', 'ชื่อ EN (Name)*': 'Digital Scale 200kg', 'ชื่อ TH (Name TH)*': 'เครื่องชั่งดิจิตอล 200kg', 'ประเภท (Equipment Type)*': 'scale', 'ขนาด/ความจุ (Capacity)': '200 kg', 'รายละเอียด (Description)': '' },
    ],
  },
  environmentalConditions: {
    label: 'Environmental Conditions (สภาวะแวดล้อม)',
    apiUrl: '/api/master-data/environmental-conditions',
    templateFileName: 'Template_Environmental_Conditions.xlsx',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true },
      { header: 'ชื่อ (Name)*', field: 'name', required: true },
      { header: 'อุณหภูมิต่ำสุด °C (Temp Min)', field: 'temperatureMin', required: false, note: 'ค่าเริ่มต้น: 20' },
      { header: 'อุณหภูมิสูงสุด °C (Temp Max)', field: 'temperatureMax', required: false, note: 'ค่าเริ่มต้น: 30' },
      { header: 'ความชื้นสูงสุด % (Humidity Max)', field: 'humidityMax', required: false, note: 'ค่าเริ่มต้น: 60' },
      { header: 'ตรวจทุก (นาที) (Interval Min)', field: 'monitoringIntervalMinutes', required: false, note: 'ค่าเริ่มต้น: 60' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'ENV-001', 'ชื่อ (Name)*': 'Standard Room', 'อุณหภูมิต่ำสุด °C (Temp Min)': 20, 'อุณหภูมิสูงสุด °C (Temp Max)': 30, 'ความชื้นสูงสุด % (Humidity Max)': 60, 'ตรวจทุก (นาที) (Interval Min)': 60, 'หมายเหตุ (Notes)': '' },
    ],
  },
  sopTemplates: {
    label: 'SOP Templates (แม่แบบ SOP)',
    apiUrl: '/api/master-data/sop-templates',
    templateFileName: 'Template_SOP_Templates.xlsx',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true },
      { header: 'ชื่อ EN (Name)', field: 'name', required: false },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'หมวด (Category)*', field: 'category', required: true, note: 'line_clearance, dispensing, preparation, milling, sieving, drying, blending, mixing, heating, cooling, filling, packaging, ipc, weighing, cleaning, inspection, other' },
      { header: 'คำแนะนำ EN (Instructions)', field: 'instructions', required: false },
      { header: 'คำแนะนำ TH (Instructions TH)', field: 'instructionsTh', required: false },
    ],
    validValues: { category: ['line_clearance', 'dispensing', 'preparation', 'milling', 'sieving', 'drying', 'blending', 'mixing', 'heating', 'cooling', 'filling', 'packaging', 'ipc', 'weighing', 'cleaning', 'inspection', 'other'] },
    exampleRows: [
      { 'รหัส (Code)*': 'SOP-001', 'ชื่อ EN (Name)': 'Line Clearance', 'ชื่อ TH (Name TH)*': 'ตรวจสอบสายการผลิต', 'หมวด (Category)*': 'line_clearance', 'คำแนะนำ EN (Instructions)': 'Check production line cleanliness', 'คำแนะนำ TH (Instructions TH)': 'ตรวจสอบความสะอาดสายการผลิต' },
    ],
  },
  packagingQCCriteria: {
    label: 'Packaging QC Criteria (เกณฑ์ QC บรรจุ)',
    apiUrl: '/api/master-data/packaging-qc-criteria',
    templateFileName: 'Template_Packaging_QC_Criteria.xlsx',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true },
      { header: 'ชื่อ (Name)*', field: 'name', required: true },
      { header: 'น้ำหนักต่ำสุด (Weight Min)*', field: 'weightMin', required: true },
      { header: 'น้ำหนักสูงสุด (Weight Max)*', field: 'weightMax', required: true },
      { header: 'จำนวนตัวอย่าง (Sample Size)', field: 'sampleSize', required: false, note: 'ค่าเริ่มต้น: 20' },
      { header: 'ไม่ผ่านสูงสุด (Max Failures)', field: 'maxFailures', required: false, note: 'ค่าเริ่มต้น: 2' },
      { header: 'ตรวจทุก (นาที)', field: 'checkIntervalMinutes', required: false, note: 'ค่าเริ่มต้น: 30' },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'PKG-001', 'ชื่อ (Name)*': 'Capsule 500mg', 'น้ำหนักต่ำสุด (Weight Min)*': 480, 'น้ำหนักสูงสุด (Weight Max)*': 520, 'จำนวนตัวอย่าง (Sample Size)': 20, 'ไม่ผ่านสูงสุด (Max Failures)': 2, 'ตรวจทุก (นาที)': 30 },
    ],
  },
  ipcCriteria: {
    label: 'IPC Criteria (เกณฑ์ IPC)',
    apiUrl: '/api/master-data/ipc-criteria',
    templateFileName: 'Template_IPC_Criteria.xlsx',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)', field: 'nameTh', required: false },
      { header: 'วิธีทดสอบ (Test Method)', field: 'testMethod', required: false },
      { header: 'Specification', field: 'specification', required: false, note: 'เช่น 300 ± 5%' },
      { header: 'ค่าต่ำสุด (Min)', field: 'minValue', required: false },
      { header: 'ค่าสูงสุด (Max)', field: 'maxValue', required: false },
      { header: 'หน่วย (Unit)', field: 'unit', required: false },
      { header: 'จำนวนตัวอย่าง (Sample Size)', field: 'sampleSize', required: false, note: 'ค่าเริ่มต้น: 5' },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'IPC-001', 'ชื่อ EN (Name)*': 'Average Weight', 'ชื่อ TH (Name TH)': 'น้ำหนักเฉลี่ย', 'วิธีทดสอบ (Test Method)': 'USP <905>', 'Specification': '300 ± 5%', 'ค่าต่ำสุด (Min)': 285, 'ค่าสูงสุด (Max)': 315, 'หน่วย (Unit)': 'mg', 'จำนวนตัวอย่าง (Sample Size)': 10 },
    ],
  },
};

export default function MasterDataPage() {
  const t = useTranslations('masterData');
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // Check admin role
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.user?.role?.toLowerCase() === 'admin') {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  // Download template for selected module
  const handleDownloadTemplate = (moduleKey: string) => {
    const config = IMPORT_CONFIGS[moduleKey];
    if (!config) return;

    // Data sheet with examples
    const ws = XLSX.utils.json_to_sheet(config.exampleRows);
    ws['!cols'] = config.columns.map(() => ({ wch: 25 }));

    // Instruction sheet
    const instrRows: (string | number)[][] = [
      [`คำแนะนำ Template: ${config.label}`],
      [''],
      ['ฟิลด์ที่มี * คือฟิลด์บังคับ (Required)'],
      [''],
      ['คอลัมน์', 'ฟิลด์', 'บังคับ', 'หมายเหตุ'],
      ...config.columns.map(c => [c.header, c.field, c.required ? 'ใช่' : 'ไม่', c.note || '']),
    ];

    // Add valid values section
    if (config.validValues) {
      instrRows.push(['']);
      for (const [field, values] of Object.entries(config.validValues)) {
        instrRows.push([`ค่าที่รองรับสำหรับ ${field}:`]);
        values.forEach(v => instrRows.push(['', v]));
      }
    }

    const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
    wsInstr['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 50 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInstr, 'คำแนะนำ');
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, config.templateFileName);
    toast.success('ดาวน์โหลดสำเร็จ', `Template ${config.label}`);
  };

  // Download ALL templates in one file
  const handleDownloadAllTemplates = () => {
    const wb = XLSX.utils.book_new();

    // Index sheet
    const indexRows = [
      ['Master Data Import Templates - Herbal Medicine ERP'],
      [''],
      ['แต่ละ Sheet คือ Template ของ Master Data แต่ละประเภท'],
      ['กรอกข้อมูลใน Sheet ที่ต้องการ แล้วนำเข้าทีละ Sheet'],
      [''],
      ['Sheet', 'คำอธิบาย'],
      ...Object.values(IMPORT_CONFIGS).map(c => [c.label, c.columns.filter(col => col.required).map(col => col.field).join(', ')]),
    ];
    const wsIndex = XLSX.utils.aoa_to_sheet(indexRows);
    wsIndex['!cols'] = [{ wch: 40 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsIndex, 'คำแนะนำ');

    for (const [, config] of Object.entries(IMPORT_CONFIGS)) {
      const ws = XLSX.utils.json_to_sheet(config.exampleRows);
      ws['!cols'] = config.columns.map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(wb, ws, config.label.split(' (')[0].substring(0, 31));
    }

    XLSX.writeFile(wb, 'Master_Data_Templates_All.xlsx');
    toast.success('ดาวน์โหลดสำเร็จ', 'Template ทุกประเภทในไฟล์เดียว');
  };

  // Handle file import
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedModule) return;

    const config = IMPORT_CONFIGS[selectedModule];
    if (!config) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.find(n => n !== 'คำแนะนำ') || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

        if (jsonData.length === 0) {
          toast.error('ไฟล์ว่าง', 'ไม่พบข้อมูลในไฟล์');
          return;
        }

        // Parse and validate
        const validRows: Record<string, unknown>[] = [];
        const errors: string[] = [];

        jsonData.forEach((row, index) => {
          const rowNum = index + 2;
          const parsed: Record<string, unknown> = {};

          for (const col of config.columns) {
            // Match by header or field name
            const val = row[col.header] ?? row[col.field] ?? '';
            const strVal = String(val).trim();

            if (col.required && !strVal) {
              errors.push(`แถว ${rowNum}: ไม่มี ${col.header}`);
              return;
            }

            if (strVal) {
              // Validate against valid values
              if (config.validValues?.[col.field]) {
                const lower = strVal.toLowerCase();
                if (!config.validValues[col.field].includes(lower)) {
                  errors.push(`แถว ${rowNum}: ${col.field} "${strVal}" ไม่ถูกต้อง`);
                  return;
                }
                parsed[col.field] = lower;
              } else {
                // Auto-convert numbers
                const num = Number(strVal);
                parsed[col.field] = !isNaN(num) && col.field.match(/Min|Max|Size|Failures|Interval|Value|Percent/) ? num : strVal;
              }
            }
          }

          if (Object.keys(parsed).length > 0) {
            validRows.push(parsed);
          }
        });

        if (errors.length > 0 && validRows.length === 0) {
          toast.error('ข้อมูลไม่ถูกต้อง', errors.slice(0, 5).join('\n'));
          return;
        }

        if (!confirm(`พบข้อมูล ${validRows.length} รายการ${errors.length > 0 ? ` (ข้าม ${errors.length} รายการที่ผิดพลาด)` : ''}\nนำเข้าข้อมูล ${config.label}?`)) return;

        setImporting(true);
        let success = 0;
        const importErrors: string[] = [];

        for (const row of validRows) {
          try {
            const res = await fetch(config.apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...row, isActive: true }),
            });
            const result = await res.json();
            if (!result.success) {
              importErrors.push(`${row.code}: ${result.error}`);
            } else {
              success++;
            }
          } catch (err) {
            importErrors.push(`${row.code}: ${err instanceof Error ? err.message : 'Error'}`);
          }
        }

        setImporting(false);
        setShowImportDialog(false);

        if (success > 0) {
          toast.success('นำเข้าสำเร็จ', `นำเข้า ${success} รายการ`);
        }
        if (importErrors.length > 0) {
          toast.error('บางรายการมีปัญหา', importErrors.slice(0, 3).join('\n') +
            (importErrors.length > 3 ? `\n...อีก ${importErrors.length - 3} รายการ` : ''));
        }
      } catch {
        toast.error('อ่านไฟล์ไม่ได้', 'ตรวจสอบรูปแบบไฟล์ Excel');
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />

      {/* Header */}
      <ResponsivePageHeader
        title={t('page.title')}
        subtitle={t('page.description')}
        icon={Database}
        iconBgColor="bg-gray-100"
        iconColor="text-gray-600"
        breadcrumbs={[
          { label: 'Production', href: '/production/work-orders' },
          { label: 'Master Data' },
        ]}
        actions={isAdmin ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllTemplates}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              ดาวน์โหลด Template
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Upload className="h-4 w-4" />
              นำเข้า Excel
            </button>
          </div>
        ) : undefined}
      />

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {masterDataModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${module.iconBgColor} flex items-center justify-center`}>
                <module.icon className={`h-6 w-6 ${module.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {t(`modules.${module.key}.title`)}
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-gray-500 mt-1">{t(`modules.${module.key}.description`)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">{t('about.title')}</h3>
        <p className="text-sm text-blue-700">{t('about.description')}</p>
        <ul className="mt-3 text-sm text-blue-700 space-y-1">
          <li>• <strong>{t('modules.productionRooms.title')}</strong> - {t('about.items.productionRooms')}</li>
          <li>• <strong>{t('modules.productionEquipment.title')}</strong> - {t('about.items.productionEquipment')}</li>
          <li>• <strong>{t('modules.environmentalConditions.title')}</strong> - {t('about.items.environmentalConditions')}</li>
          <li>• <strong>{t('modules.sopTemplates.title')}</strong> - {t('about.items.sopTemplates')}</li>
          <li>• <strong>{t('modules.packagingQCCriteria.title')}</strong> - {t('about.items.packagingQCCriteria')}</li>
          <li>• <strong>{t('modules.ipcCriteria.title')}</strong> - {t('about.items.ipcCriteria')}</li>
        </ul>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">นำเข้าข้อมูล Master Data</h2>
              <button onClick={() => setShowImportDialog(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Step 1: Select module */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. เลือกประเภท Master Data</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(IMPORT_CONFIGS).map(([key, config]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedModule === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="module"
                        value={key}
                        checked={selectedModule === key}
                        onChange={() => setSelectedModule(key)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-900">{config.label}</span>
                      <button
                        onClick={(e) => { e.preventDefault(); handleDownloadTemplate(key); }}
                        className="ml-auto text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" /> Template
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 2: Upload file */}
              {selectedModule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">2. เลือกไฟล์ Excel</label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5" />
                    {importing ? 'กำลังนำเข้า...' : 'คลิกเพื่อเลือกไฟล์ (.xlsx)'}
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    ฟิลด์บังคับ: {IMPORT_CONFIGS[selectedModule].columns.filter(c => c.required).map(c => c.field).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
