'use client';

/**
 * Receipt Tolerances — List Page (split-page pattern)
 * Feature: 020-goods-receipt
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Sliders, Edit, Trash2 } from 'lucide-react';
import type { ReceiptTolerance, ChecklistCategory } from '@/types/goods-receipt';

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  raw_material: 'วัตถุดิบ',
  finished_goods: 'สินค้าสำเร็จรูป',
};

export default function ReceiptTolerancesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: tolerances, isLoading } = useQuery<ReceiptTolerance[]>({
    queryKey: ['receipt-tolerances'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/receipt-tolerances?includeInactive=true');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/receipt-tolerances/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error ?? 'Delete failed');
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receipt-tolerances'] });
      if (result.mode === 'disabled') {
        toast.success('ปิดการใช้งาน', 'รายการถูกใช้งานอยู่ — ปิดการใช้งานแล้ว (ไม่ลบข้อมูล)');
      } else {
        toast.success('ลบสำเร็จ', 'ลบเกณฑ์ Tolerance เรียบร้อย');
      }
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleDelete = (row: ReceiptTolerance) => {
    const label = CATEGORY_LABELS[row.category] ?? row.category;
    if (!confirm(`ต้องการลบเกณฑ์ "${label}" หรือไม่?`)) return;
    deleteMutation.mutate(row.id);
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title="เกณฑ์ Tolerance ตรวจรับ"
        subtitle="ตั้งค่าความคลาดเคลื่อนที่ยอมรับได้สำหรับการตรวจรับ"
        icon={Sliders}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'เกณฑ์ Tolerance ตรวจรับ' },
        ]}
        actions={
          <DxButton
            text="เพิ่ม"
            icon="plus"
            type="success"
            onClick={() => router.push('/master-data/receipt-tolerances/new')}
            data-testid="btn-add-tolerance"
          />
        }
      />

      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(tolerances ?? []).map((r, i) => ({ ...r, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
          data-testid="tolerance-grid"
        >
          <DxSearchPanel visible placeholder="ค้นหา..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn
            dataField="_rowNumber"
            caption="#"
            width={60}
            alignment="center"
            allowFiltering={false}
            allowSorting={false}
            cellRender={(cell) => (
              <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
            )}
          />
          <DxColumn
            dataField="category"
            caption="หมวดสินค้า"
            minWidth={160}
            cellRender={(cell) => (
              <span className="font-medium text-emerald-700 whitespace-nowrap">
                {CATEGORY_LABELS[cell.value as ChecklistCategory] ?? cell.value}
              </span>
            )}
          />
          <DxColumn
            dataField="tolerancePercent"
            caption="เกณฑ์ (%)"
            width={140}
            alignment="right"
            cellRender={(cell) => (
              <span className="font-mono whitespace-nowrap">{Number(cell.value).toFixed(2)}%</span>
            )}
          />
          <DxColumn
            dataField="isActive"
            caption="สถานะ"
            width={110}
            cellRender={(cell) => (
              <span
                className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
              </span>
            )}
          />
          <DxColumn dataField="notes" caption="หมายเหตุ" minWidth={200} />
          <DxColumn
            caption="การดำเนินการ"
            width={110}
            allowFiltering={false}
            allowSorting={false}
            cellRender={(cell) => {
              const row = cell.data as ReceiptTolerance;
              return (
                <div className="flex gap-1">
                  <button
                    data-testid={`btn-edit-tolerance-${row.id}`}
                    onClick={() => router.push(`/master-data/receipt-tolerances/${row.id}`)}
                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="แก้ไข"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    data-testid={`btn-delete-tolerance-${row.id}`}
                    onClick={() => handleDelete(row)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="ลบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        </DxDataGrid>
      </div>
    </div>
  );
}
