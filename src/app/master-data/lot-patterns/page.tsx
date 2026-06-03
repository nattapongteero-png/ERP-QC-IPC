'use client';
/**
 * Lot Number Pattern master.
 *
 * 2 sections — system + vendor. Each is editable in its own DxPopup
 * with a live preview (3 sample lot numbers for system; 2 sample
 * validity checks for vendor regex).
 */
import { useEffect, useMemo, useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Tag, Sparkles, Shield } from 'lucide-react';

type PatternType = 'system' | 'vendor';
type DateFormat = 'YYYYMMDD' | 'YYMMDD' | 'BE-YYMMDD' | 'BE-YYYYMMDD' | 'YYYY-MM-DD' | 'none';

interface PatternRow {
  id: number;
  patternType: PatternType;
  prefix: string;
  separator: string;
  includeDate: boolean;
  dateFormat: DateFormat;
  sequenceType: 'random' | 'sequential';
  sequenceLength: number;
  sequenceStart: number;
  regexPattern: string | null;
  hintTh: string | null;
  hintEn: string | null;
  isActive: boolean;
  notes: string | null;
  previewSample?: string;
}

const SEPARATOR_OPTIONS = [
  { id: '-', name: 'ขีดกลาง  -' },
  { id: '_', name: 'ขีดล่าง  _' },
  { id: '/', name: 'ทับ  /' },
  { id: '.', name: 'จุด  .' },
  { id: '', name: '(ไม่ใส่)' },
];

const DATE_FORMAT_OPTIONS = [
  { id: 'YYYYMMDD', name: 'YYYYMMDD  (เช่น 20260603)' },
  { id: 'YYMMDD', name: 'YYMMDD  (เช่น 260603)' },
  { id: 'BE-YYMMDD', name: 'BE-YYMMDD  (พ.ศ. ย่อ เช่น 690603)' },
  { id: 'BE-YYYYMMDD', name: 'BE-YYYYMMDD  (พ.ศ. เต็ม เช่น 25690603)' },
  { id: 'YYYY-MM-DD', name: 'YYYY-MM-DD  (เช่น 2026-06-03)' },
  { id: 'none', name: '(ไม่ใส่วันที่)' },
];

const SEQUENCE_TYPE_OPTIONS = [
  { id: 'random', name: 'สุ่ม  (Random — เลขใหม่ทุกครั้ง)' },
  { id: 'sequential', name: 'ตามลำดับ  (Sequential — นับต่อจาก lot เดิม)' },
];

function previewLocal(p: {
  prefix: string; separator: string; includeDate: boolean;
  dateFormat: string; sequenceLength: number;
}, seq: number): string {
  const sep = p.separator ?? '-';
  const seqStr = String(seq).padStart(p.sequenceLength || 3, '0');
  let dateTok = '';
  if (p.includeDate) {
    const now = new Date();
    const ad = now.getFullYear();
    const be = ad + 543;
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    dateTok =
      p.dateFormat === 'YYYYMMDD' ? `${ad}${mm}${dd}` :
      p.dateFormat === 'YYMMDD' ? `${String(ad).slice(-2)}${mm}${dd}` :
      p.dateFormat === 'BE-YYMMDD' ? `${String(be).slice(-2)}${mm}${dd}` :
      p.dateFormat === 'BE-YYYYMMDD' ? `${be}${mm}${dd}` :
      p.dateFormat === 'YYYY-MM-DD' ? `${ad}-${mm}-${dd}` : '';
  }
  const parts: string[] = [];
  if (p.prefix) parts.push(p.prefix);
  if (dateTok) parts.push(dateTok);
  parts.push(seqStr);
  return parts.join(sep);
}

interface FormState {
  patternType: PatternType;
  prefix: string;
  separator: string;
  includeDate: boolean;
  dateFormat: DateFormat;
  sequenceType: 'random' | 'sequential';
  sequenceLength: number;
  sequenceStart: number;
  regexPattern: string;
  hintTh: string;
  hintEn: string;
  isActive: boolean;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  patternType: 'system',
  prefix: 'LOT',
  separator: '-',
  includeDate: true,
  dateFormat: 'YYYYMMDD',
  sequenceType: 'random',
  sequenceLength: 3,
  sequenceStart: 1,
  regexPattern: '',
  hintTh: '',
  hintEn: '',
  isActive: true,
  notes: '',
};

export default function LotPatternsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [vendorTestInput, setVendorTestInput] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master-data/lot-patterns');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'load failed');
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      toast.error('โหลดข้อมูลไม่สำเร็จ', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openEdit = (row: PatternRow) => {
    setForm({
      patternType: row.patternType,
      prefix: row.prefix,
      separator: row.separator ?? '-',
      includeDate: row.includeDate,
      dateFormat: row.dateFormat,
      sequenceType: row.sequenceType,
      sequenceLength: row.sequenceLength,
      sequenceStart: row.sequenceStart,
      regexPattern: row.regexPattern ?? '',
      hintTh: row.hintTh ?? '',
      hintEn: row.hintEn ?? '',
      isActive: row.isActive,
      notes: row.notes ?? '',
    });
    setVendorTestInput('');
    setShowEdit(true);
  };

  const submit = async () => {
    try {
      const res = await fetch('/api/master-data/lot-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          prefix: form.prefix.trim(),
          regexPattern: form.regexPattern.trim() || null,
          hintTh: form.hintTh.trim() || null,
          hintEn: form.hintEn.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'save failed');
      toast.success('บันทึกรูปแบบเลข Lot เรียบร้อย');
      setShowEdit(false);
      void load();
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ', (e as Error).message);
    }
  };

  const livePreview = useMemo(() => {
    if (form.patternType !== 'system') return [];
    const start = form.sequenceStart || 1;
    return [start, start + 1, start + 2].map((n) => previewLocal(form, n));
  }, [form]);

  const vendorTestResult = useMemo(() => {
    if (form.patternType !== 'vendor' || !form.regexPattern.trim()) return null;
    if (!vendorTestInput) return null;
    try {
      const re = new RegExp(form.regexPattern);
      return re.test(vendorTestInput);
    } catch {
      return null;
    }
  }, [form.patternType, form.regexPattern, vendorTestInput]);

  const system = rows.find((r) => r.patternType === 'system');
  const vendor = rows.find((r) => r.patternType === 'vendor');

  return (
    <div className="space-y-4 p-4">
      <ResponsivePageHeader
        title="รูปแบบเลข Lot"
        subtitle="ตั้งค่ารูปแบบเลข Lot ของระบบ และกฎตรวจเลข Lot ของผู้ขาย"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="รูปแบบทั้งหมด" value={rows.length} icon={Tag} />
        <StatCard label="ใช้งาน" value={rows.filter((r) => r.isActive).length} icon={Sparkles} iconColor="text-emerald-500" />
        <StatCard label="มีการตรวจ Vendor" value={vendor?.regexPattern ? 1 : 0} icon={Shield} iconColor="text-blue-500" />
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <strong>การใช้งาน:</strong> ตั้งค่า "เลข Lot ระบบ" จะมีผลกับปุ่ม <em>สร้าง</em> ในหน้า "รับ Lot ใหม่"
        — ตั้งค่า "เลข Lot ผู้ขาย" จะแสดงเป็น hint และตรวจรูปแบบเมื่อกรอก
      </div>

      {/* System Lot Card */}
      {system && (
        <div className="bg-white border rounded-lg p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">เลข Lot ระบบ (System)</h3>
              <p className="text-sm text-gray-500">รูปแบบที่ระบบจะสร้างให้เมื่อกดปุ่ม "สร้าง" ในหน้ารับ Lot</p>
            </div>
            <DxButton text="แก้ไข" type="default" onClick={() => openEdit(system)} data-testid="edit-system" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-gray-500">Prefix:</span> <strong className="font-mono">{system.prefix || '(ไม่มี)'}</strong></div>
            <div><span className="text-gray-500">ตัวคั่น:</span> <span className="font-mono">{system.separator || '(ไม่ใส่)'}</span></div>
            <div><span className="text-gray-500">รูปแบบวันที่:</span> {system.includeDate ? system.dateFormat : 'ไม่ใส่'}</div>
            <div>
              <span className="text-gray-500">ลำดับ:</span> {system.sequenceType === 'random' ? 'สุ่ม' : 'ตามลำดับ'}
              {' '}({system.sequenceLength} หลัก)
            </div>
          </div>
          <div className="mt-4 p-3 rounded-md bg-emerald-50 border border-emerald-200">
            <div className="text-xs text-emerald-700 font-medium mb-1">ตัวอย่างเลข Lot ที่ระบบจะสร้าง</div>
            <span
              className="font-mono text-xl font-bold text-emerald-800"
              data-testid="system-preview"
            >
              {system.previewSample || previewLocal(system, system.sequenceStart || 1)}
            </span>
          </div>
        </div>
      )}

      {/* Vendor Lot Card */}
      {vendor && (
        <div className="bg-white border rounded-lg p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">เลข Lot ผู้ขาย (Vendor)</h3>
              <p className="text-sm text-gray-500">ข้อความ hint และกฎตรวจรูปแบบเลข Lot ที่ผู้ใช้กรอก</p>
            </div>
            <DxButton text="แก้ไข" type="default" onClick={() => openEdit(vendor)} data-testid="edit-vendor" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Hint (ไทย)</div>
              <div className="font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200">{vendor.hintTh || '(ไม่ตั้ง)'}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Hint (English)</div>
              <div className="font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200">{vendor.hintEn || '(not set)'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500 mb-1">Regex ตรวจรูปแบบ</div>
              <div className="font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 break-all">
                {vendor.regexPattern || '(ไม่ตรวจ — ยอมรับทุกรูปแบบ)'}
              </div>
            </div>
          </div>
        </div>
      )}

      <DxPopup
        visible={showEdit}
        onHiding={() => setShowEdit(false)}
        title={form.patternType === 'system' ? 'แก้ไขรูปแบบเลข Lot ระบบ' : 'แก้ไขรูปแบบเลข Lot ผู้ขาย'}
        width={720}
        height="auto"
        showCloseButton
      >
        <div className="space-y-3 p-2">
          {form.patternType === 'system' ? (
            <>
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-xs text-emerald-700 font-medium mb-1">ตัวอย่างเลข Lot ที่จะสร้าง (3 ตัวอย่าง)</div>
                <div className="flex gap-3 flex-wrap">
                  {livePreview.map((code, i) => (
                    <span
                      key={i}
                      className="font-mono text-lg font-bold text-emerald-800 bg-white border border-emerald-300 px-3 py-1 rounded"
                      data-testid={`live-preview-${i}`}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Prefix</label>
                  <DxTextBox
                    placeholder="เช่น LOT, B"
                    value={form.prefix}
                    onValueChanged={(e) => setForm({ ...form, prefix: (e.value || '').toUpperCase() })}
                    data-testid="prefix-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">ตัวคั่น</label>
                  <DxSelectBox
                    dataSource={SEPARATOR_OPTIONS}
                    valueExpr="id"
                    displayExpr="name"
                    value={form.separator}
                    onValueChanged={(e) => setForm({ ...form, separator: e.value ?? '-' })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">จำนวนหลักของลำดับ</label>
                  <DxNumberBox
                    min={1}
                    max={8}
                    value={form.sequenceLength}
                    onValueChanged={(e) => setForm({ ...form, sequenceLength: Math.max(1, Math.min(8, Number(e.value || 3))) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <DxCheckBox
                    text="แทรกวันที่ในเลข Lot"
                    value={form.includeDate}
                    onValueChanged={(e) => setForm({ ...form, includeDate: !!e.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">รูปแบบวันที่</label>
                  <DxSelectBox
                    dataSource={DATE_FORMAT_OPTIONS}
                    valueExpr="id"
                    displayExpr="name"
                    value={form.dateFormat}
                    disabled={!form.includeDate}
                    onValueChanged={(e) => setForm({ ...form, dateFormat: e.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">รูปแบบลำดับ</label>
                  <DxSelectBox
                    dataSource={SEQUENCE_TYPE_OPTIONS}
                    valueExpr="id"
                    displayExpr="name"
                    value={form.sequenceType}
                    onValueChanged={(e) => setForm({ ...form, sequenceType: e.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">เริ่มต้นที่ลำดับ (ใช้กับ Sequential เท่านั้น)</label>
                  <DxNumberBox
                    min={1}
                    value={form.sequenceStart}
                    disabled={form.sequenceType !== 'sequential'}
                    onValueChanged={(e) => setForm({ ...form, sequenceStart: Math.max(1, Number(e.value || 1)) })}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Hint ภาษาไทย (placeholder)</label>
                  <DxTextBox
                    placeholder="เช่น V-LOT-XXXXX"
                    value={form.hintTh}
                    onValueChanged={(e) => setForm({ ...form, hintTh: e.value || '' })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Hint English (placeholder)</label>
                  <DxTextBox
                    placeholder="e.g. V-LOT-XXXXX"
                    value={form.hintEn}
                    onValueChanged={(e) => setForm({ ...form, hintEn: e.value || '' })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Regex สำหรับตรวจรูปแบบ (ปล่อยว่าง = ไม่ตรวจ)
                </label>
                <DxTextBox
                  placeholder="เช่น  ^V-LOT-\\d{4}$"
                  value={form.regexPattern}
                  onValueChanged={(e) => setForm({ ...form, regexPattern: e.value || '' })}
                />
              </div>

              {form.regexPattern.trim() && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <div className="text-xs text-blue-700 font-medium mb-2">ทดสอบ Regex</div>
                  <DxTextBox
                    placeholder="ลองพิมพ์เลข Lot ผู้ขาย"
                    value={vendorTestInput}
                    onValueChanged={(e) => setVendorTestInput(e.value || '')}
                  />
                  {vendorTestInput && vendorTestResult !== null && (
                    <div className="mt-2">
                      {vendorTestResult ? (
                        <Badge className="bg-emerald-100 text-emerald-700">✓ ตรงรูปแบบ</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">✕ ไม่ตรงรูปแบบ</Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <DxCheckBox
              text="ใช้งาน"
              value={form.isActive}
              onValueChanged={(e) => setForm({ ...form, isActive: !!e.value })}
            />
            <div></div>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">หมายเหตุ</label>
            <DxTextArea
              placeholder="(optional)"
              value={form.notes}
              onValueChanged={(e) => setForm({ ...form, notes: e.value || '' })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <DxButton text="ยกเลิก" onClick={() => setShowEdit(false)} />
            <DxButton text="บันทึก" type="default" onClick={submit} data-testid="submit" />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
