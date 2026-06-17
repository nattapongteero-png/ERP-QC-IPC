'use client';

/**
 * Work Order Cost Summary Component
 * Feature: 014-unit-cost (US3 - Production Cost Aggregation)
 *
 * Displays production cost breakdown:
 * - Material costs (items dispensed with WAC)
 * - Labor costs (operations × labor rate)
 * - Overhead costs (operations × overhead rate)
 * - Total and unit cost
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DataGrid, { Column } from 'devextreme-react/data-grid';
import { Loader2, Package, Clock, Factory, Calculator, AlertCircle } from 'lucide-react';
import type { ProductionCostSummary } from '@/types/unit-cost';

interface WorkOrderCostSummaryProps {
  workOrderId: number;
  showDetails?: boolean;
}

interface CostSummaryResponse {
  workOrder: {
    id: number;
    woNumber: string;
    productCode: string;
    productName: string;
    producedQty: number | null;
  };
  materials: {
    itemCode: string;
    itemName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  operations: {
    sequence: number;
    workCenterCode: string;
    actualHours: number | null;
    laborCost: number | null;
    overheadCost: number | null;
  }[];
  summary: ProductionCostSummary;
}

async function fetchCostSummary(workOrderId: number): Promise<CostSummaryResponse> {
  const res = await fetch(`/api/production/work-orders/${workOrderId}/costs?summary=true`);
  if (!res.ok) {
    throw new Error('Failed to fetch cost summary');
  }
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function WorkOrderCostSummary({ workOrderId, showDetails = true }: WorkOrderCostSummaryProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['work-order-cost-summary', workOrderId],
    queryFn: () => fetchCostSummary(workOrderId),
    staleTime: 30000,
    enabled: workOrderId > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">กำลังโหลดสรุปต้นทุน...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>โหลดสรุปต้นทุนไม่สำเร็จ</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>ไม่มีข้อมูลต้นทุน</span>
      </div>
    );
  }

  const { workOrder, materials, operations, summary } = data;

  return (
    <div className="space-y-6">
      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-100">
                <Package className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ต้นทุนวัตถุดิบ</p>
                <p className="text-xl font-bold">{formatCurrency(summary.materialCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ต้นทุนค่าแรง</p>
                <p className="text-xl font-bold">{formatCurrency(summary.laborCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-100">
                <Factory className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ต้นทุนค่าโสหุ้ย</p>
                <p className="text-xl font-bold">{formatCurrency(summary.overheadCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100">
                <Calculator className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ต้นทุนรวม / ต่อหน่วย</p>
                <p className="text-xl font-bold">
                  {formatCurrency(summary.totalCost)}
                </p>
                {summary.unitCost !== null && (
                  <p className="text-sm text-gray-500">
                    @ {formatCurrency(summary.unitCost)}/หน่วย
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Order Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลการผลิต</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">ใบสั่งผลิต</p>
              <p className="font-medium">{workOrder.woNumber}</p>
            </div>
            <div>
              <p className="text-gray-500">ผลิตภัณฑ์</p>
              <p className="font-medium">{workOrder.productCode}</p>
            </div>
            <div>
              <p className="text-gray-500">ชื่อผลิตภัณฑ์</p>
              <p className="font-medium">{workOrder.productName}</p>
            </div>
            <div>
              <p className="text-gray-500">จำนวนที่ผลิตได้</p>
              <p className="font-medium">{formatNumber(workOrder.producedQty)} หน่วย</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Material Costs Detail */}
      {showDetails && materials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              ต้นทุนวัตถุดิบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid
              dataSource={materials}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
            >
              <Column dataField="itemCode" caption="รหัสสินค้า" width={120} />
              <Column dataField="itemName" caption="ชื่อสินค้า" />
              <Column
                dataField="quantity"
                caption="จำนวน"
                dataType="number"
                width={100}
                cellRender={({ data }) => formatNumber(data.quantity)}
              />
              <Column
                dataField="unitCost"
                caption="ต้นทุนต่อหน่วย (WAC)"
                dataType="number"
                width={140}
                cellRender={({ data }) => formatCurrency(data.unitCost)}
              />
              <Column
                dataField="totalCost"
                caption="ต้นทุนรวม"
                dataType="number"
                width={140}
                cellRender={({ data }) => formatCurrency(data.totalCost)}
              />
            </DataGrid>
          </CardContent>
        </Card>
      )}

      {/* Operation Costs Detail */}
      {showDetails && operations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              ต้นทุนการดำเนินงาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid
              dataSource={operations}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
            >
              <Column dataField="sequence" caption="#" width={50} />
              <Column dataField="workCenterCode" caption="ศูนย์งาน" width={150} />
              <Column
                dataField="actualHours"
                caption="ชั่วโมงจริง"
                dataType="number"
                width={120}
                cellRender={({ data }) => formatNumber(data.actualHours)}
              />
              <Column
                dataField="laborCost"
                caption="ต้นทุนค่าแรง"
                dataType="number"
                width={140}
                cellRender={({ data }) => formatCurrency(data.laborCost)}
              />
              <Column
                dataField="overheadCost"
                caption="ต้นทุนค่าโสหุ้ย"
                dataType="number"
                width={140}
                cellRender={({ data }) => formatCurrency(data.overheadCost)}
              />
              <Column
                caption="รวม"
                dataType="number"
                width={140}
                cellRender={({ data }) => {
                  const total = (data.laborCost || 0) + (data.overheadCost || 0);
                  return formatCurrency(total);
                }}
              />
            </DataGrid>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
