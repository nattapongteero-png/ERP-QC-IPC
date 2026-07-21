'use client';

/**
 * Sales dashboard (แดชบอร์ดขาย) — sheet items 46-47.
 *
 * The sales landing used to bounce straight to the orders list, so nobody could
 * answer "how much did we sell and in what state is it" without eyeballing the
 * grid. This page reads the existing sales-summary report (which already rolls
 * the orders up by status and by customer) and draws it: value + order count,
 * value distribution by status, and the top customers by value.
 *
 * Money rules come from the report, not this page: cancelled/rejected orders are
 * excluded from the headline value but still appear in the status breakdown, so
 * "การกระจายตามสถานะ" shows where every order went.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { formatNumber } from '@/lib/utils/number-format';
import { LineChart, ShoppingBag, Coins, Calculator, PieChart as PieIcon, Users, Clock } from 'lucide-react';

import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import {
  Chart,
  CommonSeriesSettings,
  Series as ChartSeries,
  ArgumentAxis,
  ValueAxis,
  Legend as ChartLegend,
  Tooltip as ChartTooltip,
  Size,
  Grid,
} from 'devextreme-react/chart';

// ---- Report shape (mirrors ProcurementSalesReport<SalesReportRow>) ----
interface StatusBucket {
  status: string;
  count: number;
  value: number;
}
interface PartyBucket {
  name: string;
  code: string | null;
  orders: number;
  value: number;
}
interface SalesRow {
  id: number;
  soNumber: string;
  orderDate: string | null;
  requiredDate: string | null;
  shippedDate: string | null;
  customerName: string | null;
  status: string;
  totalAmount: number;
}
interface SalesReport {
  summary: {
    orders: number;
    value: number;
    avgOrderValue: number | null;
    voidedOrders: number;
    voidedValue: number;
    parties: number;
  };
  byStatus: StatusBucket[];
  byParty: PartyBucket[];
  byMonth: { month: string; orders: number; value: number }[];
  rows: SalesRow[];
  generatedAt: string;
}

/** Thai labels + chart colours per SO status (kept in step with the orders page). */
const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'ร่าง', color: '#94a3b8' },
  confirmed: { label: 'ยืนยันแล้ว', color: '#3b82f6' },
  processing: { label: 'กำลังดำเนินการ', color: '#f59e0b' },
  ready: { label: 'พร้อมส่ง', color: '#8b5cf6' },
  shipped: { label: 'จัดส่งแล้ว', color: '#06b6d4' },
  delivered: { label: 'ส่งมอบแล้ว', color: '#22c55e' },
  cancelled: { label: 'ยกเลิก', color: '#ef4444' },
  rejected: { label: 'ปฏิเสธ', color: '#dc2626' },
};

function statusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status;
}
function statusColor(status: string): string {
  return STATUS_META[status]?.color ?? '#6b7280';
}

/** Default range: start of the current year → today (a sensible "this year" view). */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default function SalesDashboardPage() {
  const router = useRouter();
  const init = defaultRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const [data, setData] = useState<SalesReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.append('dateFrom', dateFrom);
      if (dateTo) p.append('dateTo', dateTo);
      const res = await fetch(`/api/sales/reports/sales-summary?${p}`);
      const json = await res.json();
      if (json.success) setData(json.data as SalesReport);
    } catch (e) {
      console.error('Failed to fetch sales summary:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = data?.summary;

  // Value by status — every status the report saw, including voided ones.
  const statusChartData = useMemo(
    () =>
      (data?.byStatus ?? []).map((b) => ({
        status: statusLabel(b.status),
        value: b.value,
        count: b.count,
        color: statusColor(b.status),
      })),
    [data],
  );

  // Top ~8 customers by value (byParty is already sorted value-desc by the service).
  const topCustomers = useMemo(
    () =>
      (data?.byParty ?? []).slice(0, 8).map((p) => ({
        name: p.name,
        value: p.value,
        orders: p.orders,
      })),
    [data],
  );

  const recentRows = useMemo(() => (data?.rows ?? []).slice(0, 10), [data]);

  const recentColumns: DxDataGridColumn[] = [
    { dataField: 'soNumber', caption: 'เลขที่ใบสั่งขาย', width: 150 },
    { dataField: 'orderDate', caption: 'วันที่', width: 120 },
    { dataField: 'customerName', caption: 'ลูกค้า', minWidth: 180 },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 140,
      cellRender: (c) => {
        const s = String(c.data.status);
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${statusColor(s)}22`, color: statusColor(s) }}
          >
            {statusLabel(s)}
          </span>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: 'มูลค่า (บาท)',
      width: 150,
      cellRender: (c) => (
        <span className="tabular-nums">{formatNumber(Number(c.data.totalAmount))}</span>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="แดชบอร์ดขาย"
          subtitle="มูลค่าการขาย การกระจายตามสถานะ และลูกค้าหลัก"
          icon={LineChart}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton icon="refresh" text="รีเฟรช" stylingMode="outlined" onClick={fetchData} />
              <DxButton
                icon="textdocument"
                text="ไปที่ใบสั่งขาย"
                stylingMode="contained"
                type="default"
                onClick={() => router.push('/sales/orders')}
                elementAttr={{ 'data-testid': 'btn-goto-orders' }}
              />
            </div>
          }
        />

        {/* Date range filter */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">ตั้งแต่วันที่</label>
              <DxDateBox
                value={dateFrom || undefined}
                onValueChange={(v: unknown) => setDateFrom(v ? String(v).slice(0, 10) : '')}
                displayFormat="yyyy-MM-dd"
                width={170}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">ถึงวันที่</label>
              <DxDateBox
                value={dateTo || undefined}
                onValueChange={(v: unknown) => setDateTo(v ? String(v).slice(0, 10) : '')}
                displayFormat="yyyy-MM-dd"
                width={170}
              />
            </div>
          </CardContent>
        </Card>

        {/* StatCards */}
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4"
          data-testid="sales-stat-cards"
        >
          <StatCard
            label="มูลค่าขายรวม (บาท)"
            value={formatNumber(summary?.value ?? 0)}
            icon={Coins}
            tone="emerald"
            isLoading={isLoading}
            data-testid="stat-total-value"
          />
          <StatCard
            label="จำนวนใบสั่งขาย"
            value={formatNumber(summary?.orders ?? 0)}
            icon={ShoppingBag}
            tone="blue"
            isLoading={isLoading}
            data-testid="stat-order-count"
          />
          <StatCard
            label="มูลค่าเฉลี่ยต่อใบ (บาท)"
            value={
              summary?.avgOrderValue == null ? '-' : formatNumber(summary.avgOrderValue)
            }
            icon={Calculator}
            tone="violet"
            isLoading={isLoading}
            data-testid="stat-avg-value"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Chart 1 — value by status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-emerald-500" />
                มูลค่าตามสถานะ (การกระจายตามสถานะ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div data-testid="chart-value-by-status">
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    กำลังโหลด...
                  </div>
                ) : statusChartData.length > 0 ? (
                  <PieChart
                    id="sales-status-pie"
                    dataSource={statusChartData}
                    type="doughnut"
                    innerRadius={0.6}
                    palette={statusChartData.map((d) => d.color)}
                  >
                    <Size height={300} />
                    <Series argumentField="status" valueField="value">
                      <Label
                        visible={true}
                        position="columns"
                        customizeText={(e: { argumentText: string; percentText: string }) =>
                          `${e.argumentText}\n${e.percentText}`
                        }
                      >
                        <Connector visible={true} width={1} />
                      </Label>
                    </Series>
                    <Legend
                      visible={true}
                      orientation="horizontal"
                      horizontalAlignment="center"
                      verticalAlignment="bottom"
                    />
                    <Tooltip
                      enabled={true}
                      customizeTooltip={(arg: {
                        argumentText?: string;
                        originalValue?: string | number | Date;
                        percentText?: string;
                      }) => ({
                        text: `${arg.argumentText ?? ''}: ${formatNumber(
                          Number(arg.originalValue ?? 0),
                        )} บาท (${arg.percentText ?? ''})`,
                      })}
                    />
                  </PieChart>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    ไม่มีข้อมูลในช่วงเวลาที่เลือก
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart 2 — top customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                ลูกค้าหลัก (มูลค่าสูงสุด)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div data-testid="chart-top-customers">
                {isLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    กำลังโหลด...
                  </div>
                ) : topCustomers.length > 0 ? (
                  <Chart id="sales-top-customers" dataSource={topCustomers} rotated={true}>
                    <Size height={300} />
                    <CommonSeriesSettings
                      type="bar"
                      argumentField="name"
                      valueField="value"
                      barWidth={22}
                      cornerRadius={4}
                    />
                    <ChartSeries name="มูลค่า (บาท)" color="#3b82f6" hoverMode="allArgumentPoints" />
                    <ArgumentAxis>
                      <Grid visible={false} />
                    </ArgumentAxis>
                    <ValueAxis>
                      <Grid visible={true} color="#E5E7EB" />
                    </ValueAxis>
                    <ChartLegend visible={false} />
                    <ChartTooltip
                      enabled={true}
                      customizeTooltip={((arg: {
                        argumentText?: string;
                        originalValue?: string | number | Date;
                      }) => ({
                        text: `${arg.argumentText ?? ''}: ${formatNumber(
                          Number(arg.originalValue ?? 0),
                        )} บาท`,
                      })) as (pointInfo: unknown) => Record<string, unknown>}
                    />
                  </Chart>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    ไม่มีข้อมูลในช่วงเวลาที่เลือก
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent orders table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              ใบสั่งขายล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div data-testid="recent-orders-table">
              <DxDataGrid
                dataSource={recentRows as unknown as Record<string, unknown>[]}
                columns={recentColumns}
                keyExpr="id"
                pageSize={10}
                sorting
                responsiveColumns
                onRowClick={(e: { data?: SalesRow }) => {
                  if (e.data?.id) router.push(`/sales/orders/${e.data.id}`);
                }}
                noDataText="ไม่มีใบสั่งขายในช่วงเวลาที่เลือก"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
