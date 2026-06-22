'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column, Paging, Pager, Sorting, LoadPanel, SearchPanel,
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

// Category keys map to testCatalog.list.categories.* translation keys.
const CATEGORY_KEYS = ['chemical', 'physical', 'microbial', 'sensory', 'stability', 'other'] as const;

export default function QcTestCatalogPage() {
  const router = useRouter();
  const t = useTranslations('quality');

  const categoryLabel = (category: string) =>
    (CATEGORY_KEYS as readonly string[]).includes(category)
      ? t(`testCatalog.list.categories.${category}`)
      : category;

  const CATEGORY_FILTER_OPTIONS = useMemo(
    () => [
      { value: '', label: t('testCatalog.list.filters.all') },
      ...CATEGORY_KEYS.map((c) => ({ value: c, label: t(`testCatalog.list.categories.${c}`) })),
    ],
    [t],
  );

  const ACTIVE_FILTER_OPTIONS = useMemo(
    () => [
      { value: 'true', label: t('testCatalog.list.filters.active') },
      { value: 'false', label: t('testCatalog.list.filters.inactive') },
      { value: 'all', label: t('testCatalog.list.filters.all') },
    ],
    [t],
  );

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
      notify(t('testCatalog.list.notify.loadFailed'), 'error', 3000);
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
    if (!confirm(t('testCatalog.list.confirmDelete'))) return;
    const res = await fetch(`/api/quality/test-catalog/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j?.success) {
      notify(t('testCatalog.list.notify.deleted'), 'success', 2000);
      fetchData();
    } else {
      notify(j?.error || t('testCatalog.list.notify.deleteFailed'), 'error', 3000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title={t('testCatalog.list.title')}
        description={t('testCatalog.list.description')}
        actions={
          <DxButton
            text={t('testCatalog.list.addNew')}
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
            <div className="text-xs text-gray-500">{t('testCatalog.list.stats.total')}</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">{t('testCatalog.list.stats.active')}</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">{t('testCatalog.list.stats.categories')}</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.categories}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">{t('testCatalog.list.filterLabels.category')}</label>
              <DxSelectBox
                dataSource={CATEGORY_FILTER_OPTIONS}
                valueExpr="value"
                displayExpr="label"
                value={category}
                onValueChange={(v) => setCategory(v ?? '')}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">{t('testCatalog.list.filterLabels.status')}</label>
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
            noDataText={loading ? t('testCatalog.list.loading') : t('testCatalog.list.noData')}
          >
            <LoadPanel enabled={loading} />
            <SearchPanel visible placeholder={t('testCatalog.list.searchPlaceholder')} width={240} />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={25} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 25, 50, 100]} showInfo />

            <Column dataField="code" caption={t('testCatalog.list.columns.code')} width={110} />
            <Column dataField="name" caption={t('testCatalog.list.columns.nameEn')} />
            <Column dataField="nameTh" caption={t('testCatalog.list.columns.nameTh')} />
            <Column
              dataField="category"
              caption={t('testCatalog.list.columns.category')}
              width={110}
              calculateCellValue={(d: CatalogRow) => categoryLabel(d.category)}
            />
            <Column dataField="defaultUnit" caption={t('testCatalog.list.columns.unit')} width={80} />
            <Column dataField="defaultMin" caption={t('testCatalog.list.columns.min')} width={80} dataType="number" />
            <Column dataField="defaultMax" caption={t('testCatalog.list.columns.max')} width={80} dataType="number" />
            <Column dataField="testMethod" caption={t('testCatalog.list.columns.testMethod')} />
            <Column
              dataField="isActive"
              caption={t('testCatalog.list.columns.active')}
              width={80}
              dataType="boolean"
            />
            <Column
              caption={t('testCatalog.list.columns.actions')}
              width={180}
              cellRender={(cellData) => {
                const row = cellData.data as CatalogRow;
                return (
                  <div className="flex gap-1">
                    <DxButton
                      text={t('testCatalog.list.edit')}
                      icon="edit"
                      stylingMode="text"
                      onClick={() => router.push(`/quality/test-catalog/${row.id}`)}
                    />
                    {row.isActive && (
                      <DxButton
                        text={t('testCatalog.list.deactivate')}
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
