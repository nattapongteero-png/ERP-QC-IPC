'use client';

/**
 * Master Data Index Page
 * Dashboard for accessing all master data management pages.
 * Admin-only: Excel template download & import for all master data types.
 * Supports multi-module import with checkbox selection + Select All.
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Database, Building2, Wrench, Thermometer, FileText, Scale, FlaskConical,
  ChevronRight, Download, Upload, X, CheckSquare, Square,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

// ─── Master data module cards ─────────────────────────────────────────
const masterDataModules = [
  { key: 'productionRooms', href: '/master-data/production-rooms', icon: Building2, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'productionEquipment', href: '/master-data/production-equipment', icon: Wrench, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  { key: 'environmentalConditions', href: '/master-data/environmental-conditions', icon: Thermometer, iconBgColor: 'bg-teal-100', iconColor: 'text-teal-600' },
  { key: 'sopTemplates', href: '/master-data/sop-templates', icon: FileText, iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  { key: 'packagingQCCriteria', href: '/master-data/packaging-qc-criteria', icon: Scale, iconBgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  { key: 'ipcCriteria', href: '/master-data/ipc-criteria', icon: FlaskConical, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
];

// ─── Lookup values for template reference ─────────────────────────────
const ROOM_TYPES = [
  { value: 'weighing', label: 'Weighing Room (ห้องชั่งยา)' },
  { value: 'mixing', label: 'Mixing Room (ห้องผสม)' },
  { value: 'packaging', label: 'Packaging Room (ห้องบรรจุ)' },
  { value: 'storage', label: 'Storage Area (พื้นที่จัดเก็บ)' },
  { value: 'preparation', label: 'Preparation Room (ห้องเตรียม)' },
  { value: 'production', label: 'Production Room (ห้องผลิต)' },
];

const EQUIPMENT_TYPES = [
  { value: 'scale', label: 'Scale (เครื่องชั่ง)' },
  { value: 'mixer', label: 'Mixer (เครื่องผสม)' },
  { value: 'hotplate', label: 'Hotplate (เตาร้อน)' },
  { value: 'container', label: 'Container (ภาชนะ)' },
  { value: 'tool', label: 'Tool (เครื่องมือ)' },
  { value: 'filler', label: 'Filler (เครื่องบรรจุ)' },
];

const SOP_CATEGORIES = [
  { value: 'line_clearance', label: 'Line Clearance' },
  { value: 'dispensing', label: 'Dispensing' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'milling', label: 'Milling' },
  { value: 'sieving', label: 'Sieving' },
  { value: 'drying', label: 'Drying' },
  { value: 'blending', label: 'Blending' },
  { value: 'mixing', label: 'Mixing' },
  { value: 'heating', label: 'Heating' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'filling', label: 'Filling' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'ipc', label: 'IPC' },
  { value: 'weighing', label: 'Weighing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

// ─── Import config per module ─────────────────────────────────────────
interface ImportColumn {
  header: string;
  field: string;
  required: boolean;
  note?: string;
  lookupValues?: { value: string; label: string }[];
}

interface ImportConfig {
  label: string;
  sheetName: string;
  apiUrl: string;
  columns: ImportColumn[];
  validValues?: Record<string, string[]>;
  exampleRows: Record<string, string | number>[];
}

const IMPORT_CONFIGS: Record<string, ImportConfig> = {
  productionRooms: {
    label: 'Production Rooms',
    sheetName: 'Production Rooms',
    apiUrl: '/api/master-data/production-rooms',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'ประเภท (Room Type)*', field: 'roomType', required: true, lookupValues: ROOM_TYPES },
      { header: 'รายละเอียด (Description)', field: 'description', required: false },
    ],
    validValues: { roomType: ROOM_TYPES.map(r => r.value) },
    exampleRows: [
      { 'รหัส (Code)*': 'ROOM-001', 'ชื่อ EN (Name)*': 'Weighing Room 1', 'ชื่อ TH (Name TH)*': 'ห้องชั่งยา 1', 'ประเภท (Room Type)*': 'weighing', 'รายละเอียด (Description)': 'ห้องชั่งวัตถุดิบ ชั้น 2' },
      { 'รหัส (Code)*': 'ROOM-002', 'ชื่อ EN (Name)*': 'Mixing Room A', 'ชื่อ TH (Name TH)*': 'ห้องผสม A', 'ประเภท (Room Type)*': 'mixing', 'รายละเอียด (Description)': '' },
    ],
  },
  productionEquipment: {
    label: 'Production Equipment',
    sheetName: 'Production Equipment',
    apiUrl: '/api/master-data/production-equipment',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'ประเภท (Equipment Type)*', field: 'equipmentType', required: true, lookupValues: EQUIPMENT_TYPES },
      { header: 'ขนาด/ความจุ (Capacity)', field: 'capacity', required: false },
      { header: 'รายละเอียด (Description)', field: 'description', required: false },
    ],
    validValues: { equipmentType: EQUIPMENT_TYPES.map(e => e.value) },
    exampleRows: [
      { 'รหัส (Code)*': 'EQ-001', 'ชื่อ EN (Name)*': 'Digital Scale 200kg', 'ชื่อ TH (Name TH)*': 'เครื่องชั่งดิจิตอล 200kg', 'ประเภท (Equipment Type)*': 'scale', 'ขนาด/ความจุ (Capacity)': '200 kg', 'รายละเอียด (Description)': '' },
      { 'รหัส (Code)*': 'EQ-002', 'ชื่อ EN (Name)*': 'Ribbon Mixer 500L', 'ชื่อ TH (Name TH)*': 'เครื่องผสมริบบอน 500L', 'ประเภท (Equipment Type)*': 'mixer', 'ขนาด/ความจุ (Capacity)': '500 liters', 'รายละเอียด (Description)': '' },
    ],
  },
  environmentalConditions: {
    label: 'Environmental Conditions',
    sheetName: 'Env Conditions',
    apiUrl: '/api/master-data/environmental-conditions',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ (Name)*', field: 'name', required: true },
      { header: 'อุณหภูมิต่ำสุด °C', field: 'temperatureMin', required: false, note: 'ค่าเริ่มต้น: 20' },
      { header: 'อุณหภูมิสูงสุด °C', field: 'temperatureMax', required: false, note: 'ค่าเริ่มต้น: 30' },
      { header: 'ความชื้นสูงสุด %', field: 'humidityMax', required: false, note: 'ค่าเริ่มต้น: 60' },
      { header: 'ตรวจทุก (นาที)', field: 'monitoringIntervalMinutes', required: false, note: 'ค่าเริ่มต้น: 60' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'ENV-001', 'ชื่อ (Name)*': 'Standard Room', 'อุณหภูมิต่ำสุด °C': 20, 'อุณหภูมิสูงสุด °C': 30, 'ความชื้นสูงสุด %': 60, 'ตรวจทุก (นาที)': 60, 'หมายเหตุ (Notes)': '' },
      { 'รหัส (Code)*': 'ENV-002', 'ชื่อ (Name)*': 'Controlled Room', 'อุณหภูมิต่ำสุด °C': 22, 'อุณหภูมิสูงสุด °C': 28, 'ความชื้นสูงสุด %': 55, 'ตรวจทุก (นาที)': 30, 'หมายเหตุ (Notes)': 'ห้องควบคุมพิเศษ' },
    ],
  },
  sopTemplates: {
    label: 'SOP Templates',
    sheetName: 'SOP Templates',
    apiUrl: '/api/master-data/sop-templates',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)', field: 'name', required: false },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'หมวด (Category)*', field: 'category', required: true, lookupValues: SOP_CATEGORIES },
      { header: 'คำแนะนำ EN', field: 'instructions', required: false },
      { header: 'คำแนะนำ TH', field: 'instructionsTh', required: false },
    ],
    validValues: { category: SOP_CATEGORIES.map(c => c.value) },
    exampleRows: [
      { 'รหัส (Code)*': 'SOP-001', 'ชื่อ EN (Name)': 'Line Clearance', 'ชื่อ TH (Name TH)*': 'ตรวจสอบสายการผลิต', 'หมวด (Category)*': 'line_clearance', 'คำแนะนำ EN': 'Check production line', 'คำแนะนำ TH': 'ตรวจสอบความสะอาดสายการผลิต' },
    ],
  },
  packagingQCCriteria: {
    label: 'Packaging QC Criteria',
    sheetName: 'Packaging QC',
    apiUrl: '/api/master-data/packaging-qc-criteria',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ (Name)*', field: 'name', required: true },
      { header: 'น้ำหนักต่ำสุด*', field: 'weightMin', required: true },
      { header: 'น้ำหนักสูงสุด*', field: 'weightMax', required: true },
      { header: 'จำนวนตัวอย่าง', field: 'sampleSize', required: false, note: 'ค่าเริ่มต้น: 20' },
      { header: 'ไม่ผ่านสูงสุด', field: 'maxFailures', required: false, note: 'ค่าเริ่มต้น: 2' },
      { header: 'ตรวจทุก (นาที)', field: 'checkIntervalMinutes', required: false, note: 'ค่าเริ่มต้น: 30' },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'PKG-001', 'ชื่อ (Name)*': 'Capsule 500mg', 'น้ำหนักต่ำสุด*': 480, 'น้ำหนักสูงสุด*': 520, 'จำนวนตัวอย่าง': 20, 'ไม่ผ่านสูงสุด': 2, 'ตรวจทุก (นาที)': 30 },
    ],
  },
  ipcCriteria: {
    label: 'IPC Criteria',
    sheetName: 'IPC Criteria',
    apiUrl: '/api/master-data/ipc-criteria',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH', field: 'nameTh', required: false },
      { header: 'วิธีทดสอบ', field: 'testMethod', required: false },
      { header: 'Specification', field: 'specification', required: false, note: 'เช่น 300 ± 5%' },
      { header: 'ค่าต่ำสุด (Min)', field: 'minValue', required: false },
      { header: 'ค่าสูงสุด (Max)', field: 'maxValue', required: false },
      { header: 'หน่วย (Unit)', field: 'unit', required: false },
      { header: 'จำนวนตัวอย่าง', field: 'sampleSize', required: false, note: 'ค่าเริ่มต้น: 5' },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'IPC-001', 'ชื่อ EN (Name)*': 'Average Weight', 'ชื่อ TH': 'น้ำหนักเฉลี่ย', 'วิธีทดสอบ': 'USP <905>', 'Specification': '300 ± 5%', 'ค่าต่ำสุด (Min)': 285, 'ค่าสูงสุด (Max)': 315, 'หน่วย (Unit)': 'mg', 'จำนวนตัวอย่าง': 10 },
    ],
  },
};

const ALL_MODULE_KEYS = Object.keys(IMPORT_CONFIGS);

// ─── Parse helpers ────────────────────────────────────────────────────
function parseSheetRows(jsonData: Record<string, string | number>[], config: ImportConfig) {
  const validRows: Record<string, unknown>[] = [];
  const errors: string[] = [];

  jsonData.forEach((row, index) => {
    const rowNum = index + 2;
    const parsed: Record<string, unknown> = {};
    let hasError = false;

    for (const col of config.columns) {
      const val = row[col.header] ?? row[col.field] ?? '';
      const strVal = String(val).trim();

      if (col.required && !strVal) {
        errors.push(`${config.label} แถว ${rowNum}: ไม่มี ${col.header}`);
        hasError = true;
        break;
      }

      if (strVal) {
        if (config.validValues?.[col.field]) {
          const lower = strVal.toLowerCase();
          if (!config.validValues[col.field].includes(lower)) {
            errors.push(`${config.label} แถว ${rowNum}: ${col.field} "${strVal}" ไม่ถูกต้อง`);
            hasError = true;
            break;
          }
          parsed[col.field] = lower;
        } else {
          const num = Number(strVal);
          parsed[col.field] = !isNaN(num) && col.field.match(/Min|Max|Size|Failures|Interval|Value|Percent/) ? num : strVal;
        }
      }
    }

    if (!hasError && Object.keys(parsed).length > 0) {
      validRows.push(parsed);
    }
  });

  return { validRows, errors };
}

export default function MasterDataPage() {
  const t = useTranslations('masterData');
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);

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

  // Toggle module selection
  const toggleModule = (key: string) => {
    setSelectedModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleAll = () => {
    setSelectedModules(prev => prev.length === ALL_MODULE_KEYS.length ? [] : [...ALL_MODULE_KEYS]);
  };

  // Download template — includes lookup reference sheets
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Instruction sheet
    const instrRows: (string | number)[][] = [
      ['Master Data Import Templates — Herbal Medicine ERP'],
      [''],
      ['วิธีใช้:'],
      ['1. กรอกข้อมูลใน Sheet ของ Master Data แต่ละประเภท'],
      ['2. ช่องที่มี * คือฟิลด์บังคับ'],
      ['3. ช่อง lookup ดูค่าที่เลือกได้จาก Sheet "ตัวเลือก (Lookup)"'],
      ['4. นำเข้าได้หลายหัวข้อพร้อมกัน'],
      [''],
      ['หัวข้อ', 'ฟิลด์บังคับ'],
      ...Object.values(IMPORT_CONFIGS).map(c => [
        c.label,
        c.columns.filter(col => col.required).map(col => col.header).join(', '),
      ]),
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
    wsInstr['!cols'] = [{ wch: 35 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'คำแนะนำ');

    // Data sheets per module
    for (const config of Object.values(IMPORT_CONFIGS)) {
      const ws = XLSX.utils.json_to_sheet(config.exampleRows);
      ws['!cols'] = config.columns.map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    }

    // Lookup reference sheet
    const lookupRows: (string | number)[][] = [
      ['ตัวเลือก (Lookup Values)'],
      ['ใช้อ้างอิงค่าที่กรอกได้ในช่อง lookup'],
      [''],
    ];

    // Room Types
    lookupRows.push(['Room Type (ประเภทห้อง)', '']);
    lookupRows.push(['ค่า', 'คำอธิบาย']);
    ROOM_TYPES.forEach(r => lookupRows.push([r.value, r.label]));
    lookupRows.push(['']);

    // Equipment Types
    lookupRows.push(['Equipment Type (ประเภทอุปกรณ์)', '']);
    lookupRows.push(['ค่า', 'คำอธิบาย']);
    EQUIPMENT_TYPES.forEach(e => lookupRows.push([e.value, e.label]));
    lookupRows.push(['']);

    // SOP Categories
    lookupRows.push(['SOP Category (หมวด SOP)', '']);
    lookupRows.push(['ค่า', 'คำอธิบาย']);
    SOP_CATEGORIES.forEach(c => lookupRows.push([c.value, c.label]));

    const wsLookup = XLSX.utils.aoa_to_sheet(lookupRows);
    wsLookup['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsLookup, 'ตัวเลือก (Lookup)');

    XLSX.writeFile(wb, 'Master_Data_Templates.xlsx');
    toast.success('ดาวน์โหลดสำเร็จ', 'Template พร้อมตัวเลือก Lookup');
  };

  // Import from uploaded file — multi-module
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || selectedModules.length === 0) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Collect data for each selected module
        const modulesToImport: { key: string; config: ImportConfig; rows: Record<string, unknown>[] }[] = [];
        const allErrors: string[] = [];
        let totalRows = 0;

        for (const key of selectedModules) {
          const config = IMPORT_CONFIGS[key];
          // Find matching sheet by sheetName or first data sheet
          const sheetName = workbook.SheetNames.find(n =>
            n === config.sheetName || n.toLowerCase() === config.sheetName.toLowerCase()
          );

          if (!sheetName) {
            allErrors.push(`ไม่พบ Sheet "${config.sheetName}" สำหรับ ${config.label}`);
            continue;
          }

          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

          if (jsonData.length === 0) {
            allErrors.push(`${config.label}: ไม่มีข้อมูลใน Sheet "${sheetName}"`);
            continue;
          }

          const { validRows, errors } = parseSheetRows(jsonData, config);
          allErrors.push(...errors);

          if (validRows.length > 0) {
            modulesToImport.push({ key, config, rows: validRows });
            totalRows += validRows.length;
          }
        }

        if (modulesToImport.length === 0) {
          toast.error('ไม่พบข้อมูลที่นำเข้าได้', allErrors.slice(0, 5).join('\n') || 'ไม่มีข้อมูลในไฟล์');
          return;
        }

        const summary = modulesToImport.map(m => `${m.config.label}: ${m.rows.length} รายการ`).join('\n');
        if (!confirm(`พร้อมนำเข้า ${totalRows} รายการ:\n${summary}${allErrors.length > 0 ? `\n\n⚠️ ข้าม ${allErrors.length} รายการที่ผิดพลาด` : ''}`)) return;

        // Import
        setImporting(true);
        const log: string[] = [];

        for (const { config, rows } of modulesToImport) {
          let success = 0;
          const errors: string[] = [];

          for (const row of rows) {
            try {
              const res = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...row, isActive: true }),
              });
              const result = await res.json();
              if (!result.success) {
                errors.push(`${row.code}: ${result.error}`);
              } else {
                success++;
              }
            } catch (err) {
              errors.push(`${row.code}: ${err instanceof Error ? err.message : 'Error'}`);
            }
          }

          log.push(`✅ ${config.label}: นำเข้า ${success}/${rows.length} สำเร็จ`);
          if (errors.length > 0) {
            log.push(...errors.slice(0, 3).map(e => `   ❌ ${e}`));
            if (errors.length > 3) log.push(`   ...และอีก ${errors.length - 3} รายการ`);
          }
        }

        setImportLog(log);
        setImporting(false);
        toast.success('นำเข้าเสร็จสิ้น', `นำเข้า ${modulesToImport.length} หัวข้อ`);
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
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />

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
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              ดาวน์โหลด Template
            </button>
            <button
              onClick={() => { setShowImportDialog(true); setImportLog([]); }}
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
          <Link key={module.href} href={module.href} className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">นำเข้าข้อมูล Master Data</h2>
              <button onClick={() => setShowImportDialog(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Step 1: Select modules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">1. เลือกหัวข้อที่ต้องการนำเข้า</label>
                  <button
                    onClick={toggleAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {selectedModules.length === ALL_MODULE_KEYS.length ? (
                      <><CheckSquare className="h-3.5 w-3.5" /> ยกเลิกทั้งหมด</>
                    ) : (
                      <><Square className="h-3.5 w-3.5" /> เลือกทั้งหมด</>
                    )}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {ALL_MODULE_KEYS.map(key => {
                    const config = IMPORT_CONFIGS[key];
                    const isSelected = selectedModules.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModule(key)}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-900 flex-1">{config.label}</span>
                        <span className="text-xs text-gray-400">Sheet: {config.sheetName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Upload */}
              {selectedModules.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. เลือกไฟล์ Excel ({selectedModules.length} หัวข้อ)
                  </label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5" />
                    {importing ? 'กำลังนำเข้า...' : 'คลิกเพื่อเลือกไฟล์ (.xlsx)'}
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    ระบบจะอ่าน Sheet ที่ตรงกับหัวข้อที่เลือก: {selectedModules.map(k => IMPORT_CONFIGS[k].sheetName).join(', ')}
                  </p>
                </div>
              )}

              {/* Import log */}
              {importLog.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <label className="block text-sm font-medium text-gray-700 mb-2">ผลการนำเข้า:</label>
                  <div className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto">
                    {importLog.map((line, i) => (
                      <div key={i} className={line.startsWith('   ❌') ? 'text-red-600' : 'text-gray-700'}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
