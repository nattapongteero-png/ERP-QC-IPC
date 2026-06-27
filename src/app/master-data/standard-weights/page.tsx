'use client';

/**
 * Standard Weights list page (master data)
 * Feature: 021-scale-verification
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scale, Edit, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { type StandardWeight } from '@/types/scale-verification';

// Distinct neutral colour per OIML accuracy class so the column is scannable.
// Ordered most-precise (E1) to least (M1); these are type categories, not pass/fail.
const ACCURACY_CLASS_BADGE: Record<string, string> = {
  E1: 'bg-violet-100 text-violet-800',
  E2: 'bg-indigo-100 text-indigo-800',
  F1: 'bg-sky-100 text-sky-800',
  F2: 'bg-teal-100 text-teal-800',
  M1: 'bg-amber-100 text-amber-800',
};

export default function StandardWeightsPage() {
  const t = useTranslations('scaleVerification');
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, refetch } = useQuery<StandardWeight[]>({
    queryKey: ['standard-weights-admin'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/standard-weights?includeInactive=true');
      if (!res.ok) throw new Error('Failed to load');
      const body = await res.json();
      return (body?.data ?? body) as StandardWeight[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/standard-weights/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Failed to delete');
      return body as { mode: 'deleted' | 'disabled' };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['standard-weights-admin'] });
      queryClient.invalidateQueries({ queryKey: ['standard-weights'] });
      if (result.mode === 'disabled') {
        toast.success('ปิดการใช้งาน', 'รายการนี้ถูกใช้งานแล้ว — ปิดการใช้งานแทนการลบ');
      } else {
        toast.success('ลบสำเร็จ', 'ลบลูกตุ้มมาตรฐานเรียบร้อย');
      }
      refetch();
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleDelete = (row: StandardWeight) => {
    if (!confirm(`ต้องการลบรายการนี้หรือไม่? (${row.code})`)) return;
    deleteMutation.mutate(row.id);
  };

  const today = Date.now();

  return (
    <div className="organic-grid p-4 md:p-6 space-y-4 w-full max-w-full overflow-hidden box-border">
      <OrganicGridTheme />
      <BackButton href="/master-data" label="ข้อมูลหลัก" />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <Scale className="w-6 h-6 text-emerald-600" />
            {t('page.standardWeights')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">จัดการลูกตุ้มมาตรฐานสำหรับการตรวจสอบเครื่องชั่ง</p>
        </div>
        <div className="flex gap-2">
          <DxButton
            text={t('actions.refresh')}
            icon="refresh"
            stylingMode="outlined"
            onClick={() => refetch()}
          />
          <DxButton
            text={t('actions.addWeight')}
            icon="plus"
            type="success"
            onClick={() => router.push('/master-data/standard-weights/new')}
            elementAttr={{ 'data-testid': 'sw-add-btn' }}
          />
        </div>
      </header>

      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(data ?? []).map((d, i) => ({ ...d, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          elementAttr={{ 'data-testid': 'standard-weights-grid' }}
        >
          <DxSearchPanel visible placeholder="ค้นหา..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={56} alignment="center" allowSorting={false} allowFiltering={false} />
          <DxColumn
            dataField="code"
            caption={t('table.columns.code')}
            width={120}
            cellRender={(cell) => (
              <span className="font-mono font-medium text-emerald-700 whitespace-nowrap">
                {cell.value}
              </span>
            )}
          />
          <DxColumn
            caption={t('table.columns.denomination')}
            width={160}
            allowSorting={false}
            allowFiltering={false}
            cellRender={(c) => {
              const r = c.data as StandardWeight;
              return (
                <span className="whitespace-nowrap">
                  {r.denominationValue} {r.denominationUnit}
                </span>
              );
            }}
          />
          <DxColumn
            dataField="accuracyClass"
            caption={t('table.columns.accuracyClass')}
            width={110}
            cellRender={(cell) => (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ACCURACY_CLASS_BADGE[cell.value as string] ?? 'bg-gray-100 text-gray-700'}`}>
                {cell.value}
              </span>
            )}
          />
          <DxColumn
            dataField="certificateNumber"
            caption={t('table.columns.certificateNumber')}
            minWidth={140}
          />
          <DxColumn
            dataField="certificateExpiryDate"
            caption={t('table.columns.certificateExpiryDate')}
            width={180}
            cellRender={(c) => {
              const v = String(c.value ?? '').slice(0, 10);
              if (!v) return null;
              const days = Math.floor((new Date(v).getTime() - today) / (1000 * 60 * 60 * 24));
              if (days < 0)
                return (
                  <span className="text-rose-700 font-medium whitespace-nowrap">
                    {v} (หมดอายุ)
                  </span>
                );
              if (days <= 30)
                return (
                  <span className="text-amber-700 font-medium whitespace-nowrap">
                    {v} (อีก {days} วัน)
                  </span>
                );
              return <span className="whitespace-nowrap">{v}</span>;
            }}
          />
          <DxColumn
            dataField="ownerDepartment"
            caption="หน่วยงานเจ้าของ"
            minWidth={120}
          />
          <DxColumn
            dataField="isActive"
            caption="ใช้งาน"
            width={90}
            cellRender={(cell) => (
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
              >
                {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
              </span>
            )}
          />
          <DxColumn
            caption={t('table.columns.actions')}
            width={100}
            alignment="center"
            allowSorting={false}
            allowFiltering={false}
            cellRender={(c) => {
              const r = c.data as StandardWeight;
              return (
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    title="แก้ไข"
                    data-testid={`sw-edit-${r.id}`}
                    className="p-1.5 rounded text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    onClick={() => router.push(`/master-data/standard-weights/${r.id}`)}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="ลบ"
                    data-testid={`sw-delete-${r.id}`}
                    className="p-1.5 rounded text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    onClick={() => handleDelete(r)}
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
