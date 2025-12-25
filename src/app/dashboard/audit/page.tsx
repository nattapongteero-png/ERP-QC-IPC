'use client';

/**
 * Audit Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T050)
 *
 * Displays 8 KPI cards for external auditor review:
 * - FR-047: RM Received YTD
 * - FR-048: RM Status Breakdown
 * - FR-049: Expiry Alerts
 * - FR-050: Min Stock Alerts
 * - FR-051: QC Summary
 * - FR-052: Production Status
 * - FR-053: Pending QC Release
 * - FR-054: FG Approved YTD
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  KpiGrid,
  RmSummaryCard,
  RmStatusCard,
  ExpiryAlertCard,
  MinStockAlertCard,
  QcSummaryCard,
  ProductionStatusCard,
  PendingQcCard,
  FgApprovedCard,
} from '@/components/dashboard';
import type { AuditKpis } from '@/lib/services/audit-dashboard-service';

async function fetchAuditKpis(): Promise<AuditKpis> {
  const response = await fetch('/api/dashboard/audit-kpis');
  if (!response.ok) {
    throw new Error('Failed to fetch audit KPIs');
  }
  return response.json();
}

export default function AuditDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-kpis'],
    queryFn: fetchAuditKpis,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Audit Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading KPIs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Audit Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error loading dashboard data. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Dashboard</h1>
          <p className="text-sm text-gray-500">
            GMP Compliance Overview for External Auditors
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date(data.generatedAt).toLocaleString()}
        </div>
      </div>

      {/* KPI Grid - Row 1: Raw Materials */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Raw Materials</h2>
        <KpiGrid columns={4}>
          <RmSummaryCard data={data.rmReceivedYtd} />
          <RmStatusCard data={data.rmStatusBreakdown} />
          <ExpiryAlertCard data={data.expiryAlerts} />
          <MinStockAlertCard data={data.minStockAlerts} />
        </KpiGrid>
      </div>

      {/* KPI Grid - Row 2: Quality & Production */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Quality & Production</h2>
        <KpiGrid columns={4}>
          <QcSummaryCard data={data.qcSummary} />
          <ProductionStatusCard data={data.productionStatus} />
          <PendingQcCard data={data.pendingQcRelease} />
          <FgApprovedCard data={data.fgApproved} />
        </KpiGrid>
      </div>

      {/* Detail Tables */}
      {(data.expiryAlerts.items.length > 0 || data.minStockAlerts.items.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Expiry Alerts Table */}
          {data.expiryAlerts.items.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3 text-gray-700">
                Upcoming Expirations (Next 30 Days)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Lot Number</th>
                      <th className="text-left py-2">Item</th>
                      <th className="text-left py-2">Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expiryAlerts.items.slice(0, 5).map((item) => (
                      <tr key={item.lotId} className="border-b hover:bg-gray-50">
                        <td className="py-2">{item.lotNumber}</td>
                        <td className="py-2">{item.itemName}</td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              item.daysUntilExpiry < 0
                                ? 'bg-red-100 text-red-700'
                                : item.daysUntilExpiry < 7
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {item.daysUntilExpiry < 0
                              ? `Expired ${Math.abs(item.daysUntilExpiry)}d ago`
                              : `${item.daysUntilExpiry}d`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Min Stock Alerts Table */}
          {data.minStockAlerts.items.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3 text-gray-700">Low Stock Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Code</th>
                      <th className="text-left py-2">Item</th>
                      <th className="text-right py-2">On Hand</th>
                      <th className="text-right py-2">Min Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.minStockAlerts.items.slice(0, 5).map((item) => (
                      <tr key={item.itemId} className="border-b hover:bg-gray-50">
                        <td className="py-2">{item.itemCode}</td>
                        <td className="py-2">{item.itemName}</td>
                        <td className="py-2 text-right">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              item.onHand < item.minStock
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {item.onHand.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 text-right">{item.minStock.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
