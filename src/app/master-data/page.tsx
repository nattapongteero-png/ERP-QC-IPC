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
  Sliders, ListChecks, ClipboardCheck, Hash, Tag, Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import {
  type ImportConfig,
  parseSheetRows,
  IMPORT_CONFIGS,
  ROOM_TYPES,
  EQUIPMENT_TYPES,
  SOP_CATEGORIES,
} from '@/lib/master-data/import';

// ─── Master data module cards ─────────────────────────────────────────
const masterDataModules = [
  { key: 'productionRooms', href: '/master-data/production-rooms', icon: Building2, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { key: 'productionEquipment', href: '/master-data/production-equipment', icon: Wrench, iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  { key: 'environmentalConditions', href: '/master-data/environmental-conditions', icon: Thermometer, iconBgColor: 'bg-teal-100', iconColor: 'text-teal-600' },
  { key: 'sopTemplates', href: '/master-data/sop-templates', icon: FileText, iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  // packagingQCCriteria card removed from the menu: packaging weight/integrity QC
  // was superseded by IPC criteria (phase=packaging) — see ExecutionDashboard
  // comment "Packaging Weight Control + Packaging Integrity cards removed". The
  // table/service stay for historical bom_packaging_qc data; only the dead menu
  // entry is hidden so operators aren't sent to an orphaned screen.
  { key: 'ipcCriteria', href: '/master-data/ipc-criteria', icon: FlaskConical, iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  // Feature 019
  { key: 'packagingTolerances', href: '/master-data/packaging-tolerances', icon: Sliders, iconBgColor: 'bg-rose-100', iconColor: 'text-rose-600' },
  // Feature 020
  { key: 'receiptTolerances', href: '/master-data/receipt-tolerances', icon: Sliders, iconBgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
  { key: 'receiptChecklistTemplates', href: '/master-data/receipt-checklist-templates', icon: ClipboardCheck, iconBgColor: 'bg-lime-100', iconColor: 'text-lime-600' },
  // Feature 021
  { key: 'standardWeights', href: '/master-data/standard-weights', icon: Scale, iconBgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  // Feature 022
  { key: 'maintenancePlanTemplates', href: '/master-data/maintenance-plan-templates', icon: ListChecks, iconBgColor: 'bg-violet-100', iconColor: 'text-violet-600' },
  // Feature 025
  { key: 'itemCodePatterns', href: '/master-data/item-code-patterns', icon: Hash, iconBgColor: 'bg-pink-100', iconColor: 'text-pink-600' },
  // Feature 026
  { key: 'lotPatterns', href: '/master-data/lot-patterns', icon: Tag, iconBgColor: 'bg-yellow-100', iconColor: 'text-yellow-700' },
];

const ALL_MODULE_KEYS = Object.keys(IMPORT_CONFIGS);

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
          let created = 0;
          let updated = 0;
          const errors: string[] = [];

          for (const row of rows) {
            try {
              // Try POST (create)
              const res = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...row, isActive: true }),
              });
              const result = await res.json();
              if (!result.success && String(result.error).includes('already exists') && row.code) {
                // Code exists — find ID and PUT (update)
                const getRes = await fetch(`${config.apiUrl}?isActive=true`);
                const getData = await getRes.json();
                const existing = (getData.data || []).find((item: Record<string, unknown>) => item.code === row.code);
                if (existing?.id) {
                  const putRes = await fetch(config.apiUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...row, id: existing.id, isActive: true }),
                  });
                  const putResult = await putRes.json();
                  if (putResult.success) { success++; updated++; }
                  else errors.push(`${row.code}: ${putResult.error}`);
                } else {
                  errors.push(`${row.code}: ${result.error}`);
                }
              } else if (!result.success) {
                errors.push(`${row.code}: ${result.error}`);
              } else {
                success++; created++;
              }
            } catch (err) {
              errors.push(`${row.code}: ${err instanceof Error ? err.message : 'Error'}`);
            }
          }

          log.push(`✅ ${config.label}: นำเข้า ${success}/${rows.length} สำเร็จ${created > 0 ? ` (สร้างใหม่ ${created})` : ''}${updated > 0 ? ` (อัปเดต ${updated})` : ''}`);
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-800 bg-white border border-emerald-100 rounded-xl shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow transition-all"
            >
              <Download className="h-4 w-4" />
              {t('actions.downloadTemplate')}
            </button>
            <button
              onClick={() => { setShowImportDialog(true); setImportLog([]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {t('actions.importExcel')}
            </button>
          </div>
        ) : undefined}
      />

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {masterDataModules.map((module) => (
          <Link key={module.href} href={module.href} className="group bg-white rounded-2xl shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-5 hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 transition-all">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${module.iconBgColor} flex items-center justify-center`}>
                <module.icon className={`h-6 w-6 ${module.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[#064E3B] group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                  {t(`modules.${module.key}.title`)}
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-[#4B7163] mt-1">{t(`modules.${module.key}.description`)}</p>
                <p className="text-xs text-emerald-600 mt-2">
                  <span className="font-medium">{t('about.usedInLabel')}:</span> {t(`modules.${module.key}.usedIn`)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* About section — a clean 2-column grid of mini reference cards (icon +
          title + description + "used in" tag). Replaces the dense single bullet
          list so users can scan each master-data type at a glance. */}
      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-6 border border-emerald-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Info className="h-4 w-4 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-emerald-900">{t('about.title')}</h3>
        </div>
        <p className="text-sm text-emerald-700/90 mb-4">{t('about.description')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {masterDataModules.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.key}
                className="flex items-start gap-3 rounded-xl bg-white border border-emerald-100/70 p-3 hover:border-emerald-300 hover:shadow-sm transition"
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${module.iconBgColor}`}>
                  <Icon className={`h-4 w-4 ${module.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{t(`modules.${module.key}.title`)}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t(`about.items.${module.key}`)}</p>
                  <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {t('about.usedInLabel')}: {t(`modules.${module.key}.usedIn`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
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
                          isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-100 hover:bg-[#F6FCF9]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModule(key)}
                          className="h-4 w-4 rounded text-emerald-600"
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
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
