'use client';

/**
 * COA Templates List Page (Phase 5)
 *
 * QA Manager designs COA templates per product category. Default templates
 * are automatically picked when generating a COA for a sample whose product
 * matches the template's category — see resolveTemplate() in coa.service.ts.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Layout,
  CheckCircle2,
  AlertTriangle,
  Star,
  Languages,
  FileText,
} from 'lucide-react';

interface CoaTemplateRow {
  id: number;
  name: string;
  productCategory: string | null;
  isDefault: boolean;
  isActive: boolean;
  language: 'th' | 'en' | 'bilingual';
  createdAt: string;
  updatedAt: string;
}

const LANG_LABEL: Record<string, string> = {
  th: 'TH',
  en: 'EN',
  bilingual: 'TH/EN',
};

export default function CoaTemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<CoaTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [search, setSearch] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/coa/templates`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data?.items || []);
      } else {
        toast.error(data.error || 'Failed to load templates');
        setRows([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load templates');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.productCategory ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function handleSetDefault(id: number) {
    setWorking(true);
    try {
      const res = await fetch(
        `/api/quality/coa/templates/${id}/set-default`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'ตั้งค่าเริ่มต้นไม่สำเร็จ');
        return;
      }
      toast.success('ตั้งเป็น default แล้ว');
      await fetchTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ตั้งค่าเริ่มต้นไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  async function handleToggleActive(row: CoaTemplateRow) {
    setWorking(true);
    try {
      const res = await fetch(`/api/quality/coa/templates/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'อัปเดตสถานะไม่สำเร็จ');
        return;
      }
      toast.success(row.isActive ? 'ปิดการใช้งานแล้ว' : 'เปิดการใช้งานแล้ว');
      await fetchTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปเดตสถานะไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

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
      dataField: 'name',
      caption: 'ชื่อเทมเพลต',
      minWidth: 200,
      cellRender: (cell) => (
        <span className="font-medium text-gray-900">{cell.data.name}</span>
      ),
    },
    {
      dataField: 'productCategory',
      caption: 'หมวดสินค้า',
      width: 180,
      cellRender: (cell) =>
        cell.data.productCategory ? (
          <Badge variant="info">{cell.data.productCategory}</Badge>
        ) : (
          <Badge variant="default">Global</Badge>
        ),
    },
    {
      dataField: 'language',
      caption: 'ภาษา',
      width: 100,
      alignment: 'center',
      cellRender: (cell) => (
        <Badge variant="default">
          {LANG_LABEL[String(cell.data.language)] ?? cell.data.language}
        </Badge>
      ),
    },
    {
      dataField: 'isDefault',
      caption: 'Default?',
      width: 110,
      alignment: 'center',
      cellRender: (cell) =>
        cell.data.isDefault ? (
          <Badge variant="success">
            <Star className="inline w-3 h-3 mr-1" />
            Default
          </Badge>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      dataField: 'isActive',
      caption: 'Active?',
      width: 110,
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
      width: 320,
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <div className="flex items-center gap-1 flex-wrap">
          <DxButton
            text="Edit"
            icon="edit"
            stylingMode="outlined"
            type="default"
            onClick={() =>
              router.push(`/quality/coa/templates/${cell.data.id}`)
            }
          />
          {!cell.data.isDefault && cell.data.isActive ? (
            <DxButton
              text="Set Default"
              icon="favorites"
              stylingMode="outlined"
              type="success"
              onClick={() => handleSetDefault(cell.data.id)}
              disabled={working}
            />
          ) : null}
          <DxButton
            text={cell.data.isActive ? 'Deactivate' : 'Activate'}
            icon={cell.data.isActive ? 'remove' : 'check'}
            stylingMode="outlined"
            type={cell.data.isActive ? 'danger' : 'default'}
            onClick={() => handleToggleActive(cell.data)}
            disabled={working}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="COA Templates"
          subtitle="เทมเพลต COA — ออกแบบเลย์เอาต์ใบรับรองคุณภาพต่อหมวดสินค้า"
          icon={Layout}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'COA', href: '/quality/coa' },
            { label: 'Templates' },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text="Refresh"
                stylingMode="outlined"
                onClick={fetchTemplates}
              />
              <DxButton
                icon="plus"
                text="New Template"
                type="default"
                onClick={() => router.push('/quality/coa/templates/new')}
              />
            </div>
          }
        />

        {/* KPI strip — quick overview of how templates are configured. */}
        {(() => {
          const total = rows.length;
          const activeCount = rows.filter((r) => r.isActive).length;
          const defaultCount = rows.filter((r) => r.isDefault).length;
          const bilingualCount = rows.filter((r) => r.language === 'bilingual').length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard
                label="Total templates"
                value={total}
                icon={FileText}
                iconColor="text-emerald-500"
                accentColor="border-emerald-500"
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
              <StatCard
                label="Default"
                value={defaultCount}
                icon={Star}
                iconColor="text-amber-500"
                accentColor="border-amber-500"
                isLoading={loading}
              />
              <StatCard
                label="Bilingual (TH/EN)"
                value={bilingualCount}
                icon={Languages}
                iconColor="text-blue-500"
                accentColor="border-blue-500"
                isLoading={loading}
              />
            </div>
          );
        })()}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4">
          <DxTextBox
            placeholder="ค้นหา (ชื่อเทมเพลต, หมวดสินค้า)"
            value={search}
            onValueChange={setSearch}
            showClearButton
            mode="search"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                ยังไม่มีเทมเพลต
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                สร้างเทมเพลตแรกเพื่อกำหนดเลย์เอาต์ COA ของโรงงาน
              </p>
              <DxButton
                icon="plus"
                text="สร้างเทมเพลตแรก"
                type="default"
                onClick={() => router.push('/quality/coa/templates/new')}
              />
            </div>
          ) : (
            <DxDataGrid
              dataSource={filtered}
              keyExpr="id"
              columns={columns}
              sorting
              pageSize={20}
              height="auto"
              onRowClick={(e) => {
                if (e?.data?.id) {
                  router.push(`/quality/coa/templates/${e.data.id}`);
                }
              }}
              noDataText="ไม่พบข้อมูล"
            />
          )}
        </div>
      </div>
    </>
  );
}
