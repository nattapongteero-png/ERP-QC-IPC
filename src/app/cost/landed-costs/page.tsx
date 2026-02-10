'use client';

/**
 * Landed Costs List Page
 * Feature: 014-unit-cost
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { Truck, Eye, FileCheck, AlertCircle } from 'lucide-react';
import type { LandedCostHeader, LandedCostListFilters } from '@/types/unit-cost';

interface ListResult {
  data: LandedCostHeader[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchLandedCosts(filters: LandedCostListFilters): Promise<ListResult> {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());

  const res = await fetch(`/api/cost/landed-costs?${params}`);
  if (!res.ok) throw new Error('Failed to fetch landed costs');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  allocated: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
};

export default function LandedCostsPage() {
  const router = useRouter();
  const t = useTranslations('cost');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, error } = useQuery({
    queryKey: ['landed-costs', page, pageSize],
    queryFn: () => fetchLandedCosts({ page, pageSize }),
    staleTime: 30000,
  });

  const landedCosts = data?.data || [];
  const total = data?.total || 0;

  const handleRowClick = (e: { data: LandedCostHeader }) => {
    router.push(`/cost/landed-costs/${e.data.id}`);
  };

  return (
    <div className="p-6 space-y-6" data-testid="landed-costs-page">
      <ResponsivePageHeader
        title={t('landedCosts.page.title')}
        icon={Truck}
        subtitle={t('landedCosts.page.description')}
        actions={
          <Button
            text={t('landedCosts.actions.new')}
            icon="plus"
            type="default"
            onClick={() => router.push('/cost/landed-costs/new')}
            data-testid="new-landed-cost-btn"
          />
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('landedCosts.stats.draft')}</p>
                <p className="text-2xl font-bold">
                  {landedCosts.filter((lc) => lc.status === 'draft').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('landedCosts.stats.allocated')}</p>
                <p className="text-2xl font-bold">
                  {landedCosts.filter((lc) => lc.status === 'allocated').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <FileCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('landedCosts.stats.posted')}</p>
                <p className="text-2xl font-bold">
                  {landedCosts.filter((lc) => lc.status === 'posted').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Grid */}
      <Card>
        <CardHeader>
          <CardTitle>{t('landedCosts.grid.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="p-4 text-red-500">{t('landedCosts.errors.loadFailed')}</div>
          ) : (
            <DataGrid
              dataSource={landedCosts}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
              onRowClick={handleRowClick}
              hoverStateEnabled
              onOptionChanged={(e) => {
                if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
                  setPage((e.value as number) + 1);
                }
                if (e.name === 'paging' && e.fullName === 'paging.pageSize') {
                  setPageSize(e.value as number);
                  setPage(1);
                }
              }}
              data-testid="landed-costs-grid"
            >
              <FilterRow visible />
              <Sorting mode="single" />

              <Column
                dataField="documentNumber"
                caption={t('landedCosts.grid.columns.documentNumber')}
                width={150}
              />
              <Column
                dataField="referenceNumber"
                caption={t('landedCosts.grid.columns.referenceNumber')}
                width={130}
              />
              <Column
                dataField="invoiceNumber"
                caption={t('landedCosts.grid.columns.invoiceNumber')}
                width={130}
              />
              <Column
                dataField="status"
                caption={t('landedCosts.grid.columns.status')}
                width={120}
                cellRender={({ data }) => (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      statusColors[data.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {t(`landedCosts.status.${data.status}`)}
                  </span>
                )}
              />
              <Column
                dataField="totalAmount"
                caption={t('landedCosts.grid.columns.totalAmount')}
                dataType="number"
                width={140}
                cellRender={({ data }) => (
                  <span className="font-medium">
                    {formatCurrency(data.totalAmount)} {data.currency}
                  </span>
                )}
              />
              <Column
                dataField="createdAt"
                caption={t('landedCosts.grid.columns.created')}
                width={120}
                cellRender={({ data }) => formatDate(data.createdAt)}
              />
              <Column
                dataField="postedAt"
                caption={t('landedCosts.grid.columns.posted')}
                width={120}
                cellRender={({ data }) => formatDate(data.postedAt)}
              />

              <Paging enabled pageSize={pageSize} pageIndex={page - 1} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50]}
                showInfo
                infoText={`Showing {0}-{1} of ${total}`}
              />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
