'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column, Paging, Pager, FilterRow, Sorting, HeaderFilter, LoadPanel, SearchPanel,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { PageHeader } from '@/components/ui/page-header';

interface CatalogRow {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  category: string;
  testMethod: string | null;
  defaultUnit: string | null;
  defaultMin: number | string | null;
  defaultMax: number | string | null;
  isActive: boolean;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  chemical: 'Chemical',
  physical: 'Physical',
  microbial: 'Microbial',
  sensory: 'Sensory',
  stability: 'Stability',
  other: 'Other',
};

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'chemical', label: 'Chemical' },
  { value: 'physical', label: 'Physical' },
  { value: 'microbial', label: 'Microbial' },
  { value: 'sensory', label: 'Sensory' },
  { value: 'stability', label: 'Stability' },
  { value: 'other', label: 'Other' },
];

const ACTIVE_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
  { value: 'all', label: 'ทั้งหมด' },
];

export default function QcTestCatalogPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [active, setActive] = useState('true');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (active !== 'all') params.set('isActive', active);
      params.set('limit', '1000');
      const res = await fetch(`/api/quality/test-catalog?${params.toString()}`);
      const j = await res.json();
      if (j?.success) setRows(j.data?.data ?? []);
    } catch {
      notify('โหลดข้อมูลไม่สำเร็จ', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, active]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activeCount = rows.filter((r) => r.isActive).length;
    const categories = new Set(rows.map((r) => r.category)).size;
    return { total, activeCount, categories };
  }, [rows]);

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบ (soft-delete — Active = false) ?')) return;
    const res = await fetch(`/api/quality/test-catalog/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j?.success) {
      notify('ลบรายการเรียบร้อย', 'success', 2000);
      fetchData();
    } else {
      notify(j?.error || 'ลบไม่สำเร็จ', 'error', 3000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="QC Test Catalog"
        description="Master data รายการทดสอบ QC — ใช้กำหนด Quality Spec"
        actions={
          <DxButton
            text="+ เพิ่ม Test ใหม่"
            type="default"
            icon="plus"
            onClick={() => router.push('/quality/test-catalog/new')}
          />
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">ทั้งหมด</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Active</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">หมวด</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.categories}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">หมวด</label>
              <DxSelectBox
                dataSource={CATEGORY_FILTER_OPTIONS}
                valueExpr="value"
                displayExpr="label"
                value={category}
                onValueChange={(v) => setCategory(v ?? '')}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">สถานะ</label>
              <DxSelectBox
                dataSource={ACTIVE_FILTER_OPTIONS}
                valueExpr="value"
                displayExpr="label"
                value={active}
                onValueChange={(v) => setActive(v ?? 'true')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={rows}
            showBorders={false}
            columnAutoWidth
            wordWrapEnabled
            keyExpr="id"
            hoverStateEnabled
            noDataText={loading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'}
          >
            <LoadPanel enabled={loading} />
            <FilterRow visible />
            <HeaderFilter visible />
            <SearchPanel visible placeholder="ค้นหา..." width={240} />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={25} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 25, 50, 100]} showInfo />

            <Column dataField="code" caption="รหัส" width={110} />
            <Column dataField="name" caption="Test (EN)" />
            <Column dataField="nameTh" caption="Test (TH)" />
            <Column
              dataField="category"
              caption="หมวด"
              width={110}
              calculateCellValue={(d: CatalogRow) => CATEGORY_LABELS[d.category] ?? d.category}
            />
            <Column dataField="defaultUnit" caption="Unit" width={80} />
            <Column dataField="defaultMin" caption="Min" width={80} dataType="number" />
            <Column dataField="defaultMax" caption="Max" width={80} dataType="number" />
            <Column dataField="testMethod" caption="วิธีทดสอบ" />
            <Column
              dataField="isActive"
              caption="Active"
              width={80}
              dataType="boolean"
            />
            <Column
              caption="การจัดการ"
              width={180}
              cellRender={(cellData) => {
                const row = cellData.data as CatalogRow;
                return (
                  <div className="flex gap-1">
                    <DxButton
                      text="แก้ไข"
                      icon="edit"
                      stylingMode="text"
                      onClick={() => router.push(`/quality/test-catalog/${row.id}`)}
                    />
                    {row.isActive && (
                      <DxButton
                        text="ปิดใช้"
                        icon="close"
                        stylingMode="text"
                        type="danger"
                        onClick={() => handleDelete(row.id)}
                      />
                    )}
                  </div>
                );
              }}
            />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}
