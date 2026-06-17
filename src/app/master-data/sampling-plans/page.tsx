'use client';

/**
 * QC Sampling Plan master — LIST page (Audit QC5)
 * Edit navigates to /master-data/sampling-plans/[id]
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { BackButton } from '@/components/shared/BackButton';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';
import { useToast } from '@/hooks/use-toast';
import { Layers, CheckCircle2, ListChecks, Edit, Trash2 } from 'lucide-react';

interface PlanRow {
  id: number;
  code: string;
  name: string;
  itemId: number | null;
  itemCode: string | null;
  itemName: string | null;
  category: string | null;
  inspectionLevel: 'I' | 'II' | 'III';
  aql: number;
  sampleSize: number | null;
  acceptNumber: number | null;
  rejectNumber: number | null;
  frequency: string;
  standardRef: string | null;
  defaultSampleQty: number | null;
  defaultRetainQty: number | null;
  isActive: boolean;
  notes: string | null;
}

const FREQ_OPTIONS = [
  { id: 'every_lot', name: 'ทุกล็อต (every_lot)' },
  { id: 'random_30pct', name: 'สุ่ม 30% (random_30pct)' },
  { id: 'random_10pct', name: 'สุ่ม 10% (random_10pct)' },
  { id: 'reduced', name: 'ลดความถี่ (reduced)' },
  { id: 'tightened', name: 'เพิ่มความถี่ (tightened)' },
  { id: 'skip_lot', name: 'ข้ามบางล็อต (skip_lot)' },
];

export default function SamplingPlansPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeOnly, setActiveOnly] = useState(true);

  const { data: rows = [], isLoading } = useQuery<PlanRow[]>({
    queryKey: ['sampling-plans', activeOnly],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/sampling-plans${activeOnly ? '?activeOnly=true' : ''}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: PlanRow) => {
      const res = await fetch(`/api/master-data/sampling-plans/${row.id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'ลบไม่สำเร็จ');
      return j?.data as { mode: 'deleted' | 'disabled' };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sampling-plans'] });
      if (result?.mode === 'disabled') {
        toast.warning('รายการนี้ถูกใช้งานแล้ว — ปิดการใช้งานแทนการลบ');
      } else {
        toast.success('ลบแล้ว', 'ลบแผนชักตัวอย่างเรียบร้อย');
      }
    },
    onError: (error: Error) => {
      toast.error('ลบไม่สำเร็จ', error.message);
    },
  });

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      itemScoped: rows.filter((r) => r.itemId).length,
    }),
    [rows],
  );

  return (
    <div className="organic-grid space-y-4 p-4">
      <OrganicGridTheme />
      <BackButton href="/master-data" label="ข้อมูลหลัก" />

      <ResponsivePageHeader
        title="ทะเบียนแผนชักตัวอย่าง QC"
        subtitle="กำหนดแผนชักตัวอย่างตามรายการ/หมวดหมู่ — AQL, ขนาดตัวอย่าง, ความถี่"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'แผนชักตัวอย่าง QC' },
        ]}
        actions={
          <DxButton
            text="+ แผนใหม่"
            type="default"
            onClick={() => router.push('/master-data/sampling-plans/new')}
            data-testid="sampling-plan-add"
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="แผนทั้งหมด" value={stats.total} icon={Layers} />
        <StatCard label="ใช้งาน" value={stats.active} icon={CheckCircle2} iconColor="text-emerald-500" />
        <StatCard label="ผูกกับรายการเฉพาะ" value={stats.itemScoped} icon={ListChecks} />
      </div>

      <div className="flex items-center gap-3 bg-white border border-emerald-100 rounded-xl p-3 shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            data-testid="active-only-filter"
          />
          แสดงเฉพาะที่ใช้งาน
        </label>
      </div>

      <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-2">
        <DxDataGrid
          dataSource={rows}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
          data-testid="sampling-plans-grid"
        >
          <DxSearchPanel visible placeholder="ค้นหาแผน..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn
            dataField="code"
            caption="รหัส"
            width={160}
            cellRender={(cell) => (
              <span className="font-mono font-medium text-emerald-700 whitespace-nowrap">{cell.value}</span>
            )}
          />
          <DxColumn dataField="name" caption="ชื่อแผน" minWidth={180} />
          <DxColumn
            caption="ขอบเขต"
            minWidth={180}
            cellRender={(cell) => {
              const d = cell.data as PlanRow;
              if (d.itemCode) {
                return (
                  <span className="text-xs whitespace-nowrap">
                    รายการ: <strong>{d.itemCode}</strong>{' '}
                    <span className="text-gray-500">— {d.itemName || ''}</span>
                  </span>
                );
              }
              if (d.category) return <span className="text-xs whitespace-nowrap">หมวดหมู่: <strong>{d.category}</strong></span>;
              return <span className="text-xs text-gray-500 whitespace-nowrap">ค่าเริ่มต้นทั่วไป</span>;
            }}
          />
          <DxColumn dataField="inspectionLevel" caption="ระดับ" width={80} alignment="center" />
          <DxColumn dataField="aql" caption="AQL" width={70} alignment="center" />
          <DxColumn dataField="sampleSize" caption="n" width={60} alignment="center" />
          <DxColumn
            dataField="frequency"
            caption="ความถี่"
            minWidth={140}
            cellRender={(cell) => {
              const opt = FREQ_OPTIONS.find((o) => o.id === cell.value);
              return <span className="text-xs whitespace-nowrap">{opt?.name || cell.value}</span>;
            }}
          />
          <DxColumn dataField="standardRef" caption="มาตรฐาน" width={120} />
          <DxColumn
            dataField="isActive"
            caption="ใช้งาน"
            width={80}
            alignment="center"
            cellRender={(cell) =>
              cell.value ? (
                <Badge className="bg-emerald-100 text-emerald-700 whitespace-nowrap">ใช้งาน</Badge>
              ) : (
                <Badge className="bg-gray-200 text-gray-600 whitespace-nowrap">ปิด</Badge>
              )
            }
          />
          <DxColumn
            caption="การดำเนินการ"
            width={110}
            alignment="center"
            cellRender={(cell) => (
              <div className="flex items-center justify-center gap-1">
                <button
                  className="p-1.5 rounded text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                  onClick={() => router.push(`/master-data/sampling-plans/${(cell.data as PlanRow).id}`)}
                  title="แก้ไข"
                  data-testid={`edit-${(cell.data as PlanRow).id}`}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  className="p-1.5 rounded text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  onClick={() => {
                    const row = cell.data as PlanRow;
                    if (confirm(`ต้องการลบรายการนี้หรือไม่?\n\nแผน: ${row.code} — ${row.name}`)) {
                      deleteMutation.mutate(row);
                    }
                  }}
                  title="ลบ"
                  data-testid={`delete-${(cell.data as PlanRow).id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          />
        </DxDataGrid>
      </div>
    </div>
  );
}
