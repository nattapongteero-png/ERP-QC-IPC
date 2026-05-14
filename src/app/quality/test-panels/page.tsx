'use client';

/**
 * QC Test Panels — master CRUD
 *
 * Per design §3.2 qc_test_panels: each row maps a single ipc_criteria to a
 * product (or product_category) for default-panel seeding when registering
 * a sample. This admin page lets QA configure those rows.
 *
 * Layout is intentionally simple — list grouped by product, dialog for add/edit.
 * Operators rarely touch this once configured.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, Package, CheckCircle2, FolderOpen } from 'lucide-react';

interface TestPanelRow {
  id: number;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  productCategory: string | null;
  criteriaId: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
  isRequired: boolean;
  sequence: number;
  isActive: boolean;
}

interface ProductOption {
  id: number;
  code: string;
  nameTh: string;
  category?: string | null;
}

interface CriteriaOption {
  id: number;
  code: string;
  name: string;
  nameTh?: string | null;
}

interface FormState {
  id: number | null;
  productId: number | null;
  productCategory: string;
  /** Single criteria — used when editing an existing row. */
  criteriaId: number | null;
  /** Multi criteria — used when creating new rows. Each entry creates one row. */
  criteriaIds: number[];
  isRequired: boolean;
  sequence: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  productId: null,
  productCategory: '',
  criteriaId: null,
  criteriaIds: [],
  isRequired: true,
  sequence: 1,
  isActive: true,
};

export default function TestPanelsAdminPage() {
  const toast = useToast();

  const [rows, setRows] = useState<TestPanelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [criteria, setCriteria] = useState<CriteriaOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchPanels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quality/test-panels');
      const data = await res.json();
      if (data.success) {
        setRows(data.data?.items || []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPanels();
  }, [fetchPanels]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/items?limit=500');
        const data = await res.json();
        if (data.success) setProducts(data.data?.items || []);
      } catch {
        // ignore
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/master-data/ipc-criteria');
        const data = await res.json();
        if (data.success) {
          setCriteria(Array.isArray(data.data) ? data.data : []);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const productItems = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.nameTh}`,
      })),
    [products],
  );
  const criteriaItems = useMemo(
    () =>
      criteria.map((c) => ({
        id: c.id,
        label: `${c.code} — ${c.nameTh || c.name}`,
      })),
    [criteria],
  );

  const productCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [products]);

  const handleNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleEdit = (row: TestPanelRow) => {
    setForm({
      id: row.id,
      productId: row.productId,
      productCategory: row.productCategory ?? '',
      criteriaId: row.criteriaId,
      criteriaIds: [],
      isRequired: row.isRequired,
      sequence: row.sequence,
      isActive: row.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.productId && !form.productCategory) {
      toast.error('กรุณาเลือกสินค้าหรือหมวดหมู่อย่างน้อย 1 อย่าง');
      return;
    }
    const isNew = form.id == null;

    // Edit mode = single criteria; New mode = multi-select array.
    if (!isNew && !form.criteriaId) {
      toast.error('กรุณาเลือกเกณฑ์ (criteria)');
      return;
    }
    if (isNew && form.criteriaIds.length === 0) {
      toast.error('กรุณาเลือกเกณฑ์ (criteria) อย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    try {
      if (isNew) {
        // Create one row per selected criteria. Sequence auto-increments
        // starting from form.sequence so operators don't have to assign each.
        const startSeq = Math.max(1, Number(form.sequence) || 1);
        let okCount = 0;
        const failures: string[] = [];

        for (let i = 0; i < form.criteriaIds.length; i++) {
          const criteriaId = form.criteriaIds[i];
          const payload = {
            productId: form.productId,
            productCategory: form.productCategory || null,
            criteriaId,
            isRequired: form.isRequired,
            sequence: startSeq + i,
            isActive: form.isActive,
          };
          try {
            const res = await fetch('/api/quality/test-panels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
              okCount++;
            } else {
              failures.push(`criteria #${criteriaId}: ${data.error || 'unknown error'}`);
            }
          } catch (e) {
            failures.push(`criteria #${criteriaId}: ${e instanceof Error ? e.message : 'network error'}`);
          }
        }

        if (failures.length === 0) {
          toast.success('เพิ่มแล้ว', `${okCount} รายการ`);
          setShowForm(false);
          await fetchPanels();
        } else if (okCount > 0) {
          toast.warning(
            `เพิ่มสำเร็จ ${okCount}/${form.criteriaIds.length}`,
            failures.join('\n'),
          );
          await fetchPanels();
        } else {
          toast.error('เพิ่มไม่สำเร็จ', failures.join('\n'));
        }
      } else {
        // Edit existing row — single PUT with single criteriaId.
        const payload = {
          productId: form.productId,
          productCategory: form.productCategory || null,
          criteriaId: form.criteriaId,
          isRequired: form.isRequired,
          sequence: form.sequence,
          isActive: form.isActive,
        };
        const res = await fetch(`/api/quality/test-panels/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error('บันทึกไม่สำเร็จ', data.error || 'Unknown error');
        } else {
          toast.success('อัปเดตแล้ว');
          setShowForm(false);
          await fetchPanels();
        }
      }
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ลบ panel-row นี้ใช่หรือไม่?')) return;
    try {
      const res = await fetch(`/api/quality/test-panels/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('ลบไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success('ลบแล้ว');
        await fetchPanels();
      }
    } catch (e) {
      toast.error('ลบไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    }
  };

  const columns: DxDataGridColumn[] = [
    {
      caption: 'ลำดับ',
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <span className="text-sm text-gray-500">{(cell.rowIndex ?? 0) + 1}</span>
      ),
    },
    {
      dataField: 'productCode',
      caption: 'สินค้า',
      minWidth: 220,
      cellRender: (cell) => (
        <div>
          {cell.data.productCode ? (
            <>
              <p className="font-mono text-xs text-gray-500">
                {cell.data.productCode}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {cell.data.productName}
              </p>
            </>
          ) : (
            <span className="text-xs text-gray-500 italic">
              category-level
            </span>
          )}
          {cell.data.productCategory && (
            <p className="text-xs text-gray-500">
              cat: {cell.data.productCategory}
            </p>
          )}
        </div>
      ),
    },
    {
      dataField: 'sequence',
      caption: '#',
      width: 60,
      alignment: 'center',
    },
    {
      dataField: 'criteriaCode',
      caption: 'เกณฑ์ (Criteria)',
      minWidth: 220,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs text-gray-500">
            {cell.data.criteriaCode || '—'}
          </p>
          <p className="text-sm">
            {cell.data.criteriaNameTh || cell.data.criteriaName || '—'}
          </p>
        </div>
      ),
    },
    {
      dataField: 'isRequired',
      caption: 'Required',
      width: 100,
      alignment: 'center',
      cellRender: (cell) =>
        cell.data.isRequired ? (
          <Badge variant="primary">Required</Badge>
        ) : (
          <Badge variant="default">Optional</Badge>
        ),
    },
    {
      dataField: 'isActive',
      caption: 'Active',
      width: 100,
      alignment: 'center',
      cellRender: (cell) =>
        cell.data.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="default">Inactive</Badge>
        ),
    },
    {
      dataField: '_actions',
      caption: 'การกระทำ',
      width: 130,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <div className="flex items-center justify-center gap-1">
          <DxButton
            icon="edit"
            stylingMode="text"
            onClick={() => handleEdit(cell.data as TestPanelRow)}
          />
          <DxButton
            icon="trash"
            type="danger"
            stylingMode="text"
            onClick={() => handleDelete(cell.data.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="Test Panels"
          subtitle="กำหนดชุดทดสอบเริ่มต้นต่อสินค้า/หมวดหมู่ (สำหรับ apply ตอนลงทะเบียน QC)"
          icon={ListChecks}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'Test Panels' },
          ]}
          actions={
            <DxButton
              icon="plus"
              text="เพิ่ม panel-row"
              type="default"
              onClick={handleNew}
            />
          }
        />

        {/* KPI strip — quick overview of how panels are distributed across
            specific products vs category-level fallbacks. */}
        {(() => {
          const total = rows.length;
          const productSpecific = rows.filter((r) => r.productId != null).length;
          const categoryLevel = rows.filter((r) => r.productId == null && r.productCategory).length;
          const activeCount = rows.filter((r) => r.isActive).length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard
                label="Total panel rows"
                value={total}
                icon={ListChecks}
                iconColor="text-cyan-500"
                accentColor="border-cyan-500"
                isLoading={loading}
              />
              <StatCard
                label="Product-specific"
                value={productSpecific}
                icon={Package}
                iconColor="text-emerald-500"
                accentColor="border-emerald-500"
                isLoading={loading}
              />
              <StatCard
                label="Category-level"
                value={categoryLevel}
                icon={FolderOpen}
                iconColor="text-amber-500"
                accentColor="border-amber-500"
                isLoading={loading}
              />
              <StatCard
                label="Active"
                value={activeCount}
                icon={CheckCircle2}
                iconColor="text-green-500"
                accentColor="border-green-500"
                isLoading={loading}
              />
            </div>
          );
        })()}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-cyan-100 flex items-center justify-center mb-4">
                <ListChecks className="h-8 w-8 text-cyan-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                ยังไม่มี Test Panel
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                กดปุ่มด้านล่างเพื่อสร้าง panel-row แรก
              </p>
              <DxButton
                icon="plus"
                text="เพิ่ม panel-row"
                type="default"
                onClick={handleNew}
              />
            </div>
          ) : (
            <DxDataGrid
              dataSource={rows}
              keyExpr="id"
              columns={columns}
              sorting
              filterRow
              headerFilter
              groupPanel
              pageSize={50}
              height="auto"
              onRowClick={(e) => {
                // Click row → open edit dialog (single-row mode). Edit/delete
                // icons in the action column still work for explicit clicks.
                if (e?.data?.id) {
                  handleEdit(e.data as TestPanelRow);
                }
              }}
              noDataText="ไม่พบข้อมูล"
            />
          )}
        </div>
      </div>

      {/* Form dialog */}
      <DxPopup
        visible={showForm}
        onHiding={() => {
          if (!submitting) setShowForm(false);
        }}
        title={form.id ? 'แก้ไข panel-row' : 'เพิ่ม panel-row'}
        // Responsive width — fills 95vw on small phones, caps at 560 on tablets
        // and up so dialogs don't overflow the viewport.
        width="min(560px, 95vw)"
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-600">
            กำหนดสินค้า <em>หรือ</em> หมวดหมู่อย่างน้อย 1 อย่าง — หากกรอกทั้งคู่
            ระบบจะ match สินค้าก่อน
          </p>
          <DxSelectBox
            label="สินค้า (เฉพาะเจาะจง)"
            value={form.productId}
            dataSource={productItems}
            displayExpr="label"
            valueExpr="id"
            onValueChange={(v) =>
              setForm({ ...form, productId: v == null ? null : Number(v) })
            }
            searchEnabled
            showClearButton
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DxSelectBox
              label="หมวดหมู่ (fallback)"
              value={form.productCategory}
              items={productCategories}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) =>
                setForm({ ...form, productCategory: String(v ?? '') })
              }
              showClearButton
            />
            <DxTextBox
              label="หรือพิมพ์หมวดเอง"
              value={form.productCategory}
              onValueChange={(v) =>
                setForm({ ...form, productCategory: v || '' })
              }
            />
          </div>
          {/* New mode: multi-select; Edit mode: single. Each criteria = one row. */}
          {form.id == null ? (
            <>
              <DxTagBox
                label="เกณฑ์ (QC criteria) — เลือกได้หลายรายการ"
                value={form.criteriaIds}
                dataSource={criteriaItems as unknown as Record<string, unknown>[]}
                displayExpr="label"
                valueExpr="id"
                onValueChanged={(e) => {
                  // DevExtreme returns the new selection as an array. Cast safely
                  // — empty/undefined → []. We don't re-Number the values because
                  // valueExpr="id" already binds them as numbers from criteriaItems.
                  const next = Array.isArray(e.value) ? (e.value as number[]) : [];
                  setForm({ ...form, criteriaIds: next });
                }}
                searchEnabled
                showSelectionControls
                placeholder="พิมพ์เพื่อค้นหา หรือเลือกหลายรายการได้..."
              />
              {form.criteriaIds.length > 0 && (
                <p className="text-xs text-cyan-700">
                  จะสร้างทั้งหมด <strong>{form.criteriaIds.length}</strong> รายการ
                  (ลำดับ {form.sequence}–{form.sequence + form.criteriaIds.length - 1})
                </p>
              )}
            </>
          ) : (
            <DxSelectBox
              label="เกณฑ์ (QC criteria)"
              value={form.criteriaId}
              dataSource={criteriaItems}
              displayExpr="label"
              valueExpr="id"
              onValueChange={(v) =>
                setForm({ ...form, criteriaId: v == null ? null : Number(v) })
              }
              searchEnabled
              required
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <DxNumberBox
              label={form.id == null ? 'ลำดับเริ่มต้น' : 'ลำดับ'}
              value={form.sequence}
              onValueChange={(v) => setForm({ ...form, sequence: Number(v) || 1 })}
              min={1}
              max={999}
              step={1}
              showSpinButtons
            />
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <DxCheckBox
                  value={form.isRequired}
                  onValueChange={(v) =>
                    setForm({ ...form, isRequired: Boolean(v) })
                  }
                />
                <span>Required</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <DxCheckBox
                  value={form.isActive}
                  onValueChange={(v) => setForm({ ...form, isActive: Boolean(v) })}
                />
                <span>Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => setShowForm(false)}
              disabled={submitting}
            />
            <DxButton
              text={submitting ? 'กำลังบันทึก...' : 'บันทึก'}
              type="default"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (form.id == null
                  ? form.criteriaIds.length === 0
                  : !form.criteriaId)
              }
            />
          </div>
        </div>
      </DxPopup>
    </>
  );
}
