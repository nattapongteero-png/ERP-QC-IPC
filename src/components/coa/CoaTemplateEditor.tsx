'use client';

/**
 * COA Template Editor — Phase 5
 *
 * Visual editor for COA templates. Renders a 2-column layout:
 *   LEFT  — form panel with all template fields
 *   RIGHT — live preview embedding the actual CoaPreview component, fed
 *           with sample COA data shaped from the current form state.
 *
 * Used by both /quality/coa/templates/new and /quality/coa/templates/[id]
 * so the create and edit experiences stay identical.
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CoaPreview } from '@/components/coa/CoaPreview';
import { Eye, Save, Star, AlertTriangle, Upload, X } from 'lucide-react';
import type { CoaDocumentFull, CoaTemplate } from '@/lib/services/coa.service';

export interface CoaTemplateForm {
  name: string;
  productCategory: string | null;
  isDefault: boolean;
  isActive: boolean;
  headerLogoPath: string | null;
  headerHtml: string | null;
  footerHtml: string | null;
  signatoryRoles: string[];
  showStorageConditions: boolean;
  showExpiryDate: boolean;
  showRetestDate: boolean;
  showQrVerify: boolean;
  language: 'th' | 'en' | 'bilingual';
}

interface CoaTemplateEditorProps {
  /** undefined = create new; non-empty = edit existing */
  templateId?: number;
  /** Initial form values (e.g. fetched template); empty = blank create form */
  initialValue?: Partial<CoaTemplateForm>;
  /** All other templates — used to warn when toggling isDefault */
  otherDefaultsForCategory?: CoaTemplate[];
}

const DEFAULT_FORM: CoaTemplateForm = {
  name: '',
  productCategory: null,
  isDefault: false,
  isActive: true,
  headerLogoPath: null,
  headerHtml:
    'METAHERB CO., LTD.\n123 ถ.สมุนไพร อ.เมือง จ.นนทบุรี\nเลขทะเบียนผลิตยา: G 1234/2566',
  footerHtml:
    'References: USP 47, Ph.Eur 11, Thai Herbal Pharmacopoeia 2022\nThis certificate is computer-generated. Audit trail available on request.',
  signatoryRoles: ['analyst', 'qc_manager', 'qa_manager'],
  showStorageConditions: true,
  showExpiryDate: true,
  showRetestDate: false,
  showQrVerify: true,
  language: 'bilingual',
};

const LANGUAGE_OPTIONS = [
  { value: 'th', label: 'ภาษาไทย (Thai)' },
  { value: 'en', label: 'English' },
  { value: 'bilingual', label: 'TH + EN (Bilingual)' },
];

const SIGNATORY_ROLES = [
  { value: 'analyst', label: 'Analyst — ผู้ทดสอบ' },
  { value: 'qc_manager', label: 'QC Manager — ผู้ทบทวน' },
  { value: 'qa_manager', label: 'QA Manager — ผู้อนุมัติ' },
  { value: 'qa_release', label: 'QA Release — ผู้ปล่อยใช้งาน' },
];

/** Build a fake CoaDocumentFull from the current form state for the preview. */
function buildSampleCoa(form: CoaTemplateForm): CoaDocumentFull {
  const now = new Date();
  const issueDate = now.toISOString().slice(0, 10);
  const mfg = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
  const expiry = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 2);
  const retest = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365);

  const sampleTemplate: CoaTemplate = {
    id: 0,
    name: form.name || 'Sample Template',
    productCategory: form.productCategory,
    isDefault: form.isDefault,
    isActive: form.isActive,
    headerLogoPath: form.headerLogoPath,
    headerHtml: form.headerHtml,
    footerHtml: form.footerHtml,
    signatoryRoles: form.signatoryRoles,
    showStorageConditions: form.showStorageConditions,
    showExpiryDate: form.showExpiryDate,
    showRetestDate: form.showRetestDate,
    showQrVerify: form.showQrVerify,
    language: form.language,
    createdAt: issueDate,
    updatedAt: issueDate,
  };

  return {
    id: 0,
    coaNumber: 'COA-PREVIEW-000000',
    sampleId: 0,
    sampleNumber: 'QC-PREVIEW-0001',
    storageConditions: 'Store below 30°C, dry place',
    quantityReceived: 100,
    unit: 'capsules',
    customerCode: 'CUST-PREVIEW',
    templateId: 0,
    productId: 0,
    productCode: 'FG-PREVIEW',
    productName: 'ขมิ้นชันแคปซูล 500mg (ตัวอย่าง)',
    productNameEn: 'Curcuma longa Capsule 500mg (sample)',
    lotNumber: 'BG-PREVIEW-001',
    customerId: null,
    customerName: 'ABC Pharmacy (sample)',
    salesOrderRef: 'SO-PREVIEW-0042',
    issueDate,
    expiryDate: expiry.toISOString().slice(0, 10),
    retestDate: retest.toISOString().slice(0, 10),
    manufactureDate: mfg.toISOString().slice(0, 10),
    conclusion: 'complies',
    status: 'issued',
    supersededBy: null,
    revokeReason: null,
    qrCodeToken: 'preview-token',
    createdAt: issueDate,
    createdBy: 0,
    createdByName: 'QA Manager (sample)',
    approvedAt: issueDate,
    approvedBy: 0,
    releasedAt: issueDate,
    releasedBy: 0,
    pdfPath: null,
    pdfGeneratedAt: null,
    updatedAt: issueDate,
    template: sampleTemplate,
    results: [
      {
        id: 1,
        coaId: 0,
        sampleTestId: null,
        sequence: 1,
        testName: 'Description',
        testNameTh: 'ลักษณะ',
        testMethod: 'Visual',
        specification: 'Brown capsules, no foreign matter',
        result: 'Conforms',
        resultUnit: null,
        conclusion: 'conform',
        notes: null,
      },
      {
        id: 2,
        coaId: 0,
        sampleTestId: null,
        sequence: 2,
        testName: 'Loss on Drying',
        testNameTh: 'การสูญเสียจากการอบแห้ง',
        testMethod: 'USP <731>',
        specification: 'NMT 7.0%',
        result: '5.2',
        resultUnit: '%',
        conclusion: 'conform',
        notes: null,
      },
      {
        id: 3,
        coaId: 0,
        sampleTestId: null,
        sequence: 3,
        testName: 'Curcumin Assay',
        testNameTh: 'ปริมาณเคอร์คูมิน',
        testMethod: 'HPLC',
        specification: 'NLT 3.0%',
        result: '4.2',
        resultUnit: '%',
        conclusion: 'conform',
        notes: null,
      },
    ],
    signatures: form.signatoryRoles.map((role, idx) => ({
      id: idx + 1,
      coaId: 0,
      role,
      userId: 0,
      userNameSnapshot: 'Sample User',
      userTitleSnapshot: SIGNATORY_ROLES.find((r) => r.value === role)?.label
        .split('—')[1]
        ?.trim() ?? role,
      signedAt: issueDate,
      signatureImagePath: null,
      signatureMeaning:
        role === 'analyst' ? 'Tested' : role === 'qc_manager' ? 'Reviewed' : 'Approved',
      ipAddress: null,
    })),
    printCount: 0,
  };
}

export function CoaTemplateEditor({
  templateId,
  initialValue,
  otherDefaultsForCategory = [],
}: CoaTemplateEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const isCreate = templateId == null;

  const initialForm = useMemo<CoaTemplateForm>(
    () => ({ ...DEFAULT_FORM, ...(initialValue ?? {}) }),
    [initialValue],
  );

  const [form, setForm] = useState<CoaTemplateForm>(initialForm);
  const [debouncedForm, setDebouncedForm] = useState<CoaTemplateForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce 300ms before pushing form changes to the preview (avoids
  // expensive QR re-render on every keystroke).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedForm(form), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form]);

  // Load product categories from items master
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/quality/coa/product-categories');
        const data = await res.json();
        if (data.success) setProductCategories(data.data?.items ?? []);
      } catch {
        /* ignore — falls back to free-text */
      }
    })();
  }, []);

  function setField<K extends keyof CoaTemplateForm>(
    key: K,
    value: CoaTemplateForm[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(redirectAfter: 'list' | 'edit' = 'list') {
    if (!form.name.trim()) {
      toast.error('กรุณาระบุชื่อเทมเพลต');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        productCategory: form.productCategory?.trim() || null,
        isDefault: form.isDefault,
        isActive: form.isActive,
        headerLogoPath: form.headerLogoPath?.trim() || null,
        headerHtml: form.headerHtml?.trim() || null,
        footerHtml: form.footerHtml?.trim() || null,
        signatoryRoles: form.signatoryRoles,
        showStorageConditions: form.showStorageConditions,
        showExpiryDate: form.showExpiryDate,
        showRetestDate: form.showRetestDate,
        showQrVerify: form.showQrVerify,
        language: form.language,
      };
      const url = isCreate
        ? '/api/quality/coa/templates'
        : `/api/quality/coa/templates/${templateId}`;
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      toast.success(isCreate ? 'สร้างเทมเพลตแล้ว' : 'อัปเดตเทมเพลตแล้ว');
      if (isCreate && data.data?.id) {
        router.push(
          redirectAfter === 'edit'
            ? `/quality/coa/templates/${data.data.id}`
            : '/quality/coa/templates',
        );
      } else if (redirectAfter === 'list') {
        router.push('/quality/coa/templates');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  const conflictingDefaults = otherDefaultsForCategory.filter(
    (t) => t.id !== templateId && t.isDefault,
  );
  const showDefaultWarning = form.isDefault && conflictingDefaults.length > 0;

  const sampleCoa = useMemo(() => buildSampleCoa(debouncedForm), [debouncedForm]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT — Form */}
      <div className="space-y-4">
        {/* Save bar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex items-center gap-2 flex-wrap">
          <DxButton
            text={isCreate ? 'สร้าง' : 'บันทึก'}
            icon="save"
            type="success"
            onClick={() => handleSave('list')}
            disabled={saving}
          />
          <DxButton
            text="บันทึกแล้วแก้ไขต่อ"
            icon="edit"
            stylingMode="outlined"
            onClick={() => handleSave('edit')}
            disabled={saving}
          />
          <DxButton
            text="ยกเลิก"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push('/quality/coa/templates')}
            disabled={saving}
          />
        </div>

        {/* Basic info */}
        <Section title="ข้อมูลพื้นฐาน (Basic info)">
          <Field label="ชื่อเทมเพลต *">
            <DxTextBox
              value={form.name}
              onValueChange={(v) => setField('name', v ?? '')}
              placeholder="เช่น Capsule COA — Bilingual"
            />
          </Field>
          <Field label="หมวดสินค้า (Product Category)">
            <DxSelectBox
              value={form.productCategory ?? ''}
              items={[
                { value: '', label: '— ทั้งหมด (Global) —' },
                ...productCategories.map((c) => ({ value: c, label: c })),
              ]}
              displayExpr="label"
              valueExpr="value"
              acceptCustomValue
              searchEnabled
              onValueChange={(v) =>
                setField('productCategory', v ? String(v) : null)
              }
              labelMode="hidden"
            />
            <p className="text-xs text-gray-500 mt-1">
              เลือกจากรายการ หรือพิมพ์ category ใหม่. เว้นว่างเพื่อใช้เป็น default ทั้งระบบ.
            </p>
          </Field>
          <Field label="ภาษา (Language)">
            <DxSelectBox
              value={form.language}
              items={LANGUAGE_OPTIONS}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) =>
                setField('language', (v as CoaTemplateForm['language']) || 'bilingual')
              }
              labelMode="hidden"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <SwitchField
              label="ตั้งเป็น default"
              hint="เทมเพลต default จะถูกเลือกอัตโนมัติเมื่อสร้าง COA สำหรับสินค้าหมวดเดียวกัน"
              checked={form.isDefault}
              onChange={(v) => setField('isDefault', v)}
            />
            <SwitchField
              label="ใช้งาน (Active)"
              checked={form.isActive}
              onChange={(v) => setField('isActive', v)}
            />
          </div>
          {showDefaultWarning ? (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>คำเตือน:</strong> การตั้งเทมเพลตนี้เป็น default
                จะยกเลิก default ของเทมเพลต{' '}
                <span className="font-semibold">
                  {conflictingDefaults.map((t) => t.name).join(', ')}
                </span>{' '}
                ในหมวดเดียวกัน.
              </div>
            </div>
          ) : null}
        </Section>

        {/* Header config */}
        <Section title="ส่วนหัวเอกสาร (Header)">
          <Field label="โลโก้">
            <LogoUploader
              value={form.headerLogoPath ?? null}
              onChange={(v) => setField('headerLogoPath', v)}
            />
          </Field>
          <Field label="ข้อความหัวเอกสาร (Header text)">
            <DxTextArea
              value={form.headerHtml ?? ''}
              onValueChange={(v) => setField('headerHtml', v || null)}
              height={120}
              placeholder="ชื่อบริษัท / ที่อยู่ / เลขทะเบียน"
            />
            <p className="text-xs text-gray-500 mt-1">
              ข้อความล้วน + ขึ้นบรรทัดใหม่. (ไม่รองรับ HTML — ระบบจะ render เป็น plain text เพื่อความปลอดภัย)
            </p>
          </Field>
        </Section>

        {/* Footer */}
        <Section title="ส่วนท้ายเอกสาร (Footer)">
          <Field label="ข้อความท้ายเอกสาร">
            <DxTextArea
              value={form.footerHtml ?? ''}
              onValueChange={(v) => setField('footerHtml', v || null)}
              height={100}
              placeholder="References: USP 47, Ph.Eur 11..."
            />
          </Field>
        </Section>

        {/* Signatory roles */}
        <Section title="ผู้ลงนาม (Signatory Roles)">
          <DxTagBox
            items={SIGNATORY_ROLES}
            displayExpr="label"
            valueExpr="value"
            value={form.signatoryRoles}
            onValueChanged={(e) =>
              setField(
                'signatoryRoles',
                ((e.value as unknown[]) || []).map((v) => String(v)),
              )
            }
            placeholder="เลือก role ที่ต้องลงนามใน COA"
            showSelectionControls
            labelMode="hidden"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {form.signatoryRoles.map((r) => (
              <Badge key={r} variant="info">
                {SIGNATORY_ROLES.find((s) => s.value === r)?.label.split('—')[0]?.trim() ??
                  r}
              </Badge>
            ))}
          </div>
        </Section>

        {/* Layout flags */}
        <Section title="การแสดงผล (Layout flags)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SwitchField
              label="แสดง Storage Conditions"
              checked={form.showStorageConditions}
              onChange={(v) => setField('showStorageConditions', v)}
            />
            <SwitchField
              label="แสดงวันหมดอายุ (Expiry)"
              checked={form.showExpiryDate}
              onChange={(v) => setField('showExpiryDate', v)}
            />
            <SwitchField
              label="แสดงวัน Retest"
              checked={form.showRetestDate}
              onChange={(v) => setField('showRetestDate', v)}
            />
            <SwitchField
              label="แสดง QR ตรวจสอบ"
              checked={form.showQrVerify}
              onChange={(v) => setField('showQrVerify', v)}
            />
          </div>
        </Section>
      </div>

      {/* RIGHT — Preview */}
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 flex items-start gap-2">
          <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Preview ใช้ข้อมูลตัวอย่าง</strong> — ผลทดสอบ, lot number,
            วันที่ ในตัวอย่างนี้ไม่ใช่ข้อมูลจริง. เทมเพลตจะถูกใช้กับ COA จริงเมื่อมี
            sample ในหมวดสินค้าที่ตรงกัน.
          </div>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto"
          style={{ maxHeight: '85vh' }}
        >
          <CoaPreview coa={sampleCoa} watermark="PREVIEW" language={form.language} />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded border border-gray-100 bg-gray-50">
      <DxSwitch value={checked} onValueChange={onChange} />
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        {hint ? <p className="text-xs text-gray-500 mt-0.5">{hint}</p> : null}
      </div>
    </div>
  );
}

/** File upload + preview for the CoA header logo. Hits /api/uploads/coa-logo
 *  which writes the image under /public/uploads/coa-logos/ and returns the
 *  public URL path stored in coa_templates.headerLogoPath. */
function LogoUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('ไฟล์ไม่รองรับ', 'กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, SVG, WEBP, GIF)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป', 'ขนาดต้องไม่เกิน 5MB');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/uploads/coa-logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('อัปโหลดไม่สำเร็จ', data.error || 'Unknown error');
        return;
      }
      const path = data.data?.path;
      if (typeof path !== 'string' || path.length === 0) {
        toast.error('อัปโหลดไม่สำเร็จ', 'Server did not return a logo path');
        return;
      }
      onChange(path);
      toast.success('อัปโหลดสำเร็จ', path);
    } catch (e) {
      toast.error('อัปโหลดไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {value ? (
        <div className="flex items-start gap-3 p-2 border border-gray-200 rounded-md bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Logo preview"
            className="h-16 w-16 object-contain bg-white border border-gray-200 rounded"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 truncate font-mono" title={value}>
              {value}
            </p>
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={uploading}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                ลบ
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์โลโก้จากเครื่อง'}
        </button>
      )}
      <p className="text-xs text-gray-500">
        รองรับ PNG, JPG, SVG, WEBP, GIF — ขนาดไม่เกิน 5MB
      </p>
    </div>
  );
}
