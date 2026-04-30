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
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ListChecks } from 'lucide-react';

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
  criteriaId: number | null;
  isRequired: boolean;
  sequence: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  productId: null,
  productCategory: '',
  criteriaId: null,
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
      isRequired: row.isRequired,
      sequence: row.sequence,
      isActive: row.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.criteriaId) {
      toast.error('กรุณาเลือกเกณฑ์ (criteria)');
      return;
    }
    if (!form.productId && !form.productCategory) {
      toast.error('กรุณาเลือกสินค้าหรือหมวดหมู่อย่างน้อย 1 อย่าง');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        productId: form.productId,
        productCategory: form.productCategory || null,
        criteriaId: form.criteriaId,
        isRequired: form.isRequired,
        sequence: form.sequence,
        isActive: form.isActive,
      };
      const isNew = form.id == null;
      const url = isNew
        ? '/api/quality/test-panels'
        : `/api/quality/test-panels/${form.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('บันทึกไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success(isNew ? 'เพิ่มแล้ว' : 'อัปเดตแล้ว');
        setShowForm(false);
        await fetchPanels();
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
    <MainLayout>
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
        width={560}
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
          <DxSelectBox
            label="เกณฑ์ (IPC criteria)"
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
          <div className="grid grid-cols-2 gap-3">
            <DxNumberBox
              label="ลำดับ"
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
              disabled={submitting || !form.criteriaId}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}
