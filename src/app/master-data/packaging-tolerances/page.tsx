'use client';

/**
 * Packaging Tolerances — list page (split-page pattern)
 * Feature 019, Phase 8
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Sliders, Edit, Trash2 } from 'lucide-react';
import type { PackagingTolerance, PackagingCategory } from '@/types/packaging';

export default function PackagingTolerancesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('packaging');

  const { data, isLoading } = useQuery<PackagingTolerance[]>({
    queryKey: ['packaging-tolerances'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/packaging-tolerances?includeInactive=true');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: PackagingTolerance) => {
      const res = await fetch(`/api/master-data/packaging-tolerances/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error ?? 'Failed');
      return result;
    },
    onSuccess: (_result, row) => {
      queryClient.invalidateQueries({ queryKey: ['packaging-tolerances'] });
      const catLabel = t(`tolerances.categories.${row.packagingCategory as PackagingCategory}`);
      toast.success('ปิดใช้งานสำเร็จ', `Tolerance หมวด "${catLabel}" ถูกปิดใช้งานแล้ว`);
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleDelete = (row: PackagingTolerance) => {
    const catLabel = t(`tolerances.categories.${row.packagingCategory as PackagingCategory}`);
    if (window.confirm(`ปิดใช้งานหมวด "${catLabel}" หรือไม่?`)) {
      deleteMutation.mutate(row);
    }
  };

  return (
    <div
      className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border"
      data-testid="packaging-tolerances-page"
    >
      <ResponsivePageHeader
        title={t('tolerances.title')}
        subtitle="ตั้งค่าเกณฑ์ Variance Tolerance ของแต่ละหมวด Packaging — ใช้ในการตรวจสอบ Return"
        icon={Sliders}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: t('tolerances.title') },
        ]}
        actions={
          <DxButton
            text="เพิ่มหมวด"
            icon="plus"
            type="success"
            onClick={() => router.push('/master-data/packaging-tolerances/new')}
            data-testid="packaging-tolerance-add-btn"
          />
        }
      />

      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(data || []).map((r, i) => ({ ...r, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
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
            dataField="packagingCategory"
            caption={t('tolerances.columns.category')}
            minWidth={140}
            cellRender={(cell) => (
              <span className="font-medium whitespace-nowrap">
                {t(`tolerances.categories.${cell.value as PackagingCategory}`)}
              </span>
            )}
          />
          <DxColumn
            dataField="tolerancePercent"
            caption={t('tolerances.columns.tolerancePercent')}
            width={180}
            cellRender={(cell) => (
              <span className="font-semibold tabular-nums whitespace-nowrap">
                {Number(cell.value).toFixed(2)}%
              </span>
            )}
          />
          <DxColumn
            dataField="isActive"
            caption={t('tolerances.columns.isActive')}
            width={110}
            cellRender={(cell) => (
              <span
                className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
              </span>
            )}
          />
          <DxColumn
            dataField="notes"
            caption={t('tolerances.columns.notes')}
            minWidth={200}
          />
          <DxColumn
            caption="การดำเนินการ"
            width={110}
            allowFiltering={false}
            allowSorting={false}
            cellRender={(cell) => {
              const row = cell.data as PackagingTolerance;
              return (
                <div className="flex gap-1">
                  <button
                    data-testid={`packaging-tolerance-edit-${row.id}`}
                    onClick={() => router.push(`/master-data/packaging-tolerances/${row.id}`)}
                    className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                    title="แก้ไข"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    data-testid={`packaging-tolerance-delete-${row.id}`}
                    onClick={() => handleDelete(row)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="ปิดใช้งาน"
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
