'use client';

/**
 * Stability Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Main dashboard for stability program management.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StabilityStudyList } from '@/components/stability';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs, DxTabItem } from '@/components/ui/dx-tabs';
import {
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Calendar,
  FileText,
} from 'lucide-react';
import type { StabilityTrends, StabilityStudyListResponse, SampleAlert } from '@/types/stability';

// ============================================
// API Functions
// ============================================

async function fetchTrends(): Promise<StabilityTrends> {
  const response = await fetch('/api/stability/trends');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchStudies(): Promise<StabilityStudyListResponse> {
  const response = await fetch('/api/stability/studies?status=active&limit=50');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchAlerts(): Promise<SampleAlert[]> {
  const response = await fetch('/api/stability/samples/alerts?daysAhead=30');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export default function StabilityDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  // Fetch data
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['stability-trends'],
    queryFn: fetchTrends,
  });

  const { data: studiesData, isLoading: studiesLoading } = useQuery({
    queryKey: ['stability-studies-active'],
    queryFn: fetchStudies,
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['stability-alerts'],
    queryFn: fetchAlerts,
  });

  const overdueAlerts = alerts.filter((a) => a.isOverdue);
  const upcomingAlerts = alerts.filter((a) => !a.isOverdue);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Stability Program"
        subtitle="Thai FDA GMP หมวด 7.4 - Stability Testing Management"
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text="Protocols"
              icon="doc"
              onClick={() => router.push('/gmp/stability/protocols')}
              stylingMode="outlined"
            />
            <DxButton
              text="Enroll Batch"
              icon="add"
              onClick={() => router.push('/gmp/stability/studies/new')}
              type="default"
            />
          </div>
        }
      />

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FlaskConical className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trends?.totalActiveStudies || 0}</p>
              <p className="text-sm text-muted-foreground">Active Studies</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trends?.overduesamples || 0}</p>
              <p className="text-sm text-muted-foreground">Overdue Samples</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingAlerts.length}</p>
              <p className="text-sm text-muted-foreground">Due in 30 Days</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trends?.oosThisMonth || 0}</p>
              <p className="text-sm text-muted-foreground">OOS This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(overdueAlerts.length > 0 || upcomingAlerts.length > 0) && (
        <div className="bg-card border rounded-lg p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Sample Alerts
          </h2>

          {overdueAlerts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-red-600 mb-2">
                Overdue ({overdueAlerts.length})
              </h3>
              <div className="space-y-2">
                {overdueAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.sampleId}
                    className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
                  >
                    <div>
                      <span className="font-medium">{alert.studyNumber}</span>
                      <span className="text-muted-foreground mx-2">-</span>
                      <span>{alert.productName}</span>
                      <span className="text-muted-foreground mx-2">-</span>
                      <span>{alert.timepoint}M</span>
                    </div>
                    <span className="text-red-600 text-sm">
                      {Math.abs(alert.daysUntilDue)} days overdue
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingAlerts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-yellow-600 mb-2">
                Upcoming ({upcomingAlerts.length})
              </h3>
              <div className="space-y-2">
                {upcomingAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.sampleId}
                    className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800"
                  >
                    <div>
                      <span className="font-medium">{alert.studyNumber}</span>
                      <span className="text-muted-foreground mx-2">-</span>
                      <span>{alert.productName}</span>
                      <span className="text-muted-foreground mx-2">-</span>
                      <span>{alert.timepoint}M</span>
                    </div>
                    <span className="text-yellow-600 text-sm">
                      Due: {alert.scheduledDate} ({alert.daysUntilDue}d)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-card border rounded-lg shadow-sm">
        <DxTabs
          selectedIndex={activeTab}
          onOptionChanged={(e) => {
            if (e.name === 'selectedIndex') setActiveTab(e.value);
          }}
        >
          <DxTabItem title="Active Studies" icon="activefolder" />
          <DxTabItem title="By Product" icon="group" />
        </DxTabs>

        <div className="p-6">
          {activeTab === 0 && (
            <StabilityStudyList
              studies={studiesData?.studies || []}
              loading={studiesLoading}
            />
          )}
          {activeTab === 1 && (
            <div className="space-y-4">
              {trends?.studiesByProduct.map((product) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{product.productName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {product.activeStudies} active, {product.completedStudies} completed
                    </p>
                  </div>
                  <DxButton
                    text="View Studies"
                    stylingMode="outlined"
                    onClick={() =>
                      router.push(`/gmp/stability/studies?productId=${product.productId}`)
                    }
                  />
                </div>
              ))}
              {(!trends?.studiesByProduct || trends.studiesByProduct.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No studies found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
