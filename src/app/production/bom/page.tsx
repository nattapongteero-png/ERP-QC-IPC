'use client';

/**
 * BOM (Bill of Materials) Dashboard Page
 * Feature: Production Management
 *
 * Professional dashboard for managing manufacturing BOMs with DevExtreme UI.
 * Redesigned with responsive layout that properly constrains width.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardList,
  CheckCircle,
  FileEdit,
  Archive,
  Factory,
  AlertTriangle,
  ChevronRight,
  Settings,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BOMDashboard } from '@/app/api/bom/dashboard/route';

// Status configuration - Simplified workflow: draft → approved → obsolete
const statusConfig = {
  draft: { translationKey: 'draft', color: 'bg-amber-100 text-amber-800', borderColor: 'border-amber-500' },
  active: { translationKey: 'active', color: 'bg-teal-100 text-teal-800', borderColor: 'border-teal-500' },
  approved: { translationKey: 'approved', color: 'bg-green-100 text-green-800', borderColor: 'border-green-500' },
  obsolete: { translationKey: 'obsolete', color: 'bg-gray-100 text-gray-600', borderColor: 'border-gray-400' },
};

export default function BOMDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const [activeTab, setActiveTab] = useState('all');
  const statusFilter = activeTab === 'all' ? '' : activeTab;
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(580);

  // Dynamic grid height — fills remaining viewport
  useEffect(() => {
    const updateHeight = () => {
      if (gridRef.current) {
        const top = gridRef.current.getBoundingClientRect().top;
        setGridHeight(Math.max(300, Math.floor(window.innerHeight - top - 12)));
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<BOMDashboard>({
    queryKey: ['bom-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/bom/dashboard');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM list
  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom-list', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/bom?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.items || [];
    },
  });

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <span className="text-gray-500">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.color}`}>
        {status === 'active' && <CheckCircle className="h-3 w-3" />}
        {status === 'draft' && <FileEdit className="h-3 w-3" />}
        {status === 'approved' && <CheckCircle className="h-3 w-3" />}
        {status === 'obsolete' && <Archive className="h-3 w-3" />}
        {t(`bom.status.${config.translationKey}`)}
      </span>
    );
  };

  const deleteBomMutation = useMutation({
    mutationFn: async (bomId: number) => {
      const res = await fetch(`/api/bom/${bomId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-list'] });
      queryClient.invalidateQueries({ queryKey: ['bom-dashboard'] });
      toast.success('BOM Deleted', 'Draft BOM has been deleted.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const filteredBOMs = bomData?.filter((bom: { status: string }) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'approved') return bom.status === 'approved';
    if (activeTab === 'legacy') return bom.status === 'active';
    return bom.status === activeTab;
  }) || [];

  return (
    <div className="flex flex-col gap-2 p-2 md:p-3 w-full max-w-full box-border">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <nav className="text-xs text-gray-500 hidden md:block">
              <Link href="/production" className="hover:text-emerald-600 transition-colors">
                {t('breadcrumbs.production')}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-gray-700">{t('bom.breadcrumbs.bomManagement')}</span>
            </nav>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{t('bom.pageTitle')}</h1>
          </div>
        </div>
        <DxButton
          text={t('bom.actions.createNewBOM')}
          icon="plus"
          type="success"
          onClick={() => router.push('/production/bom/new')}
        />
      </div>

      {/* Compact Stats Bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-1.5">
        {dashboardLoading ? (
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <ClipboardList className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-gray-500">{t('bom.stats.totalBOMs')}</span>
              <span className="font-bold text-gray-900">{dashboard?.totalBOMs ?? 0}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-gray-500">{t('bom.stats.activeBOMs')}</span>
              <span className="font-bold text-gray-900">{dashboard?.activeBOMs ?? 0}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-sm">
              <FileEdit className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-gray-500">{t('bom.stats.draftBOMs')}</span>
              <span className="font-bold text-gray-900">{dashboard?.draftBOMs ?? 0}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={() => router.push('/production/work-orders')} className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity">
              <Factory className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-gray-500">{t('bom.stats.workOrders')}</span>
              <span className="font-bold text-blue-600">{dashboard?.activeWorkOrders ?? 0}</span>
            </button>
          </>
        )}
      </div>

      {/* Alert — single line */}
      {dashboard && dashboard.draftBOMs > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            {t('bom.alerts.draftBOMsPending', { count: dashboard.draftBOMs })}
          </span>
          <button
            onClick={() => setActiveTab('draft')}
            className="ml-auto text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center gap-0.5 shrink-0"
          >
            {t('bom.alerts.viewDraftBOMs')} <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* BOM List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden flex-1">
        {/* Header — title + tabs + filter in one row */}
        <div className="border-b border-gray-100 px-3 py-1.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Settings className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-sm">{t('bom.registry.title')}</h3>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="text-xs">
              <TabsTrigger value="all" className="text-xs px-2 py-1">
                All ({bomData?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs px-2 py-1">
                Approved ({bomData?.filter((b: { status: string }) => b.status === 'approved').length || 0})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-2 py-1">
                Draft ({bomData?.filter((b: { status: string }) => b.status === 'draft').length || 0})
              </TabsTrigger>
              <TabsTrigger value="obsolete" className="text-xs px-2 py-1">
                Obsolete ({bomData?.filter((b: { status: string }) => b.status === 'obsolete').length || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* DataGrid — compact density */}
        <div ref={gridRef} className="bom-compact-grid px-2 pb-1">
          <style>{`
            .bom-compact-grid .dx-datagrid-rowsview .dx-row > td {
              padding: 1px 7px !important;
              line-height: 1.3 !important;
              border-bottom: 1px solid #f1f5f9;
            }
            .bom-compact-grid .dx-datagrid-headers .dx-header-row > td {
              padding: 4px 7px !important;
              font-size: 0.7rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #6b7280;
            }
            .bom-compact-grid .dx-datagrid-headers .dx-datagrid-text-content {
              white-space: normal !important;
              word-wrap: break-word;
            }
            .bom-compact-grid .dx-data-row:hover > td {
              background-color: #ecfdf5 !important;
              transition: background-color 0.15s ease;
            }
            .bom-compact-grid .dx-data-row.dx-row-alt > td {
              background-color: #f8fafc;
            }
            .bom-compact-grid .dx-datagrid {
              border: none;
            }
            .bom-compact-grid .dx-toolbar {
              padding: 0 !important;
              min-height: 28px !important;
            }
            .bom-compact-grid .dx-toolbar .dx-toolbar-items-container {
              height: 28px !important;
            }
            .bom-compact-grid .dx-datagrid-pager {
              padding: 2px 8px !important;
            }
            .bom-compact-grid .dx-pager .dx-page-sizes .dx-selection,
            .bom-compact-grid .dx-pager .dx-pages .dx-selection {
              font-size: 0.75rem;
            }
          `}</style>
          <DxDataGrid
            dataSource={filteredBOMs}
            keyExpr="id"
            showBorders={false}
            rowAlternationEnabled
            loading={bomLoading}
            height={gridHeight}
            width="100%"
            columnAutoWidth
            showColumnLines={false}
            onRowClick={(e) => {
              if (e.data?.id) {
                router.push(`/production/bom/${e.data.id}`);
              }
            }}
          >
            <DxSearchPanel visible placeholder="Search..." width={160} />
            <DxPaging defaultPageSize={20} />

            <DxColumn
              dataField="code"
              caption="Code"
              minWidth={100}
              cellRender={(cell) => (
                <span className="font-mono font-medium text-emerald-700 text-sm">{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="name"
              caption="Name"
              minWidth={180}
              width={400}
              cellRender={(cell) => (
                <div className="truncate text-sm" title={cell.value}>{cell.value}</div>
              )}
            />
            <DxColumn
              dataField="productCode"
              caption="Product"
              minWidth={80}
              cellRender={(cell) => (
                <span className="font-mono text-gray-600 text-sm">{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="standardBatchSize"
              caption="Batch"
              minWidth={120}
              alignment="right"
              cellRender={(cell) => (
                <span className="tabular-nums text-sm">
                  {cell.data.standardBatchSize != null ? Number(cell.data.standardBatchSize).toLocaleString() : '-'} {cell.data.batchUnit || ''}
                </span>
              )}
            />
            <DxColumn
              dataField="version"
              caption="Version"
              width={70}
              alignment="center"
              cellRender={(cell) => (
                <span className="text-gray-500 text-sm">v{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="status"
              caption="Status"
              minWidth={100}
              cellRender={(cell) => renderStatusBadge(cell.value)}
            />
            <DxColumn
              dataField="createdAt"
              caption="Created"
              minWidth={100}
              dataType="date"
              format="yyyy-MM-dd"
            />
            <DxColumn
              caption="Actions"
              width={110}
              cellRender={(cell) => {
                const bom = cell.data as { id: number; status: string };
                const isDraft = bom.status === 'draft';
                return (
                  <div className="flex items-center gap-1">
                    {isDraft && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/production/bom/${bom.id}`);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('ต้องการลบ BOM นี้หรือไม่?')) {
                              deleteBomMutation.mutate(bom.id);
                            }
                          }}
                          disabled={deleteBomMutation.isPending}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/production/bom/${bom.id}`);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              }}
              allowFiltering={false}
              allowSorting={false}
            />
          </DxDataGrid>
        </div>
      </div>
    </div>
  );
}
