'use client';

/**
 * Complaints List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Main page for viewing and managing customer complaints.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ComplaintList, ComplaintTrendsChart } from '@/components/complaints';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { MessageSquareWarning, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
} from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintDashboard {
  totalOpen: number;
  byStatus: Record<ComplaintStatus, number>;
  bySeverity: Record<ComplaintSeverity, number>;
  pendingInvestigation: number;
  resolvedThisMonth: number;
  criticalCount: number;
}

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<ComplaintDashboard> {
  const response = await fetch('/api/complaints/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export default function ComplaintsListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | undefined>(undefined);
  const [severityFilter, setSeverityFilter] = useState<ComplaintSeverity | undefined>(undefined);

  // Fetch dashboard statistics
  const { data: dashboard } = useQuery({
    queryKey: ['complaints-dashboard'],
    queryFn: fetchDashboard,
  });

  // Handlers
  const handleComplaintSelect = (complaint: Complaint) => {
    router.push(`/gmp/complaints/${complaint.id}`);
  };

  const handleNewComplaint = () => {
    router.push('/gmp/complaints/new');
  };

  // Status filter options
  const statusOptions = [
    { value: null, label: 'All Statuses' },
    { value: 'received', label: 'Received' },
    { value: 'under_investigation', label: 'Under Investigation' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  // Category filter options
  const categoryOptions = [
    { value: null, label: 'All Categories' },
    { value: 'quality', label: 'Quality' },
    { value: 'efficacy', label: 'Efficacy' },
    { value: 'safety', label: 'Safety' },
    { value: 'packaging', label: 'Packaging' },
    { value: 'labeling', label: 'Labeling' },
    { value: 'other', label: 'Other' },
  ];

  // Severity filter options
  const severityOptions = [
    { value: null, label: 'All Severities' },
    { value: 'minor', label: 'Minor' },
    { value: 'major', label: 'Major' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Customer Complaints"
        subtitle="Complaint Management (หมวด 9)"
        actions={
          <DxButton
            text="New Complaint"
            icon="add"
            type="success"
            onClick={handleNewComplaint}
          />
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Complaints"
          value={dashboard?.totalOpen || 0}
          icon={MessageSquareWarning}
          iconColor="text-blue-500"
        />
        <StatCard
          label="Pending Investigation"
          value={dashboard?.pendingInvestigation || 0}
          icon={Clock}
          iconColor="text-yellow-500"
        />
        <StatCard
          label="Critical"
          value={dashboard?.criticalCount || 0}
          icon={AlertTriangle}
          iconColor={dashboard?.criticalCount && dashboard.criticalCount > 0 ? 'text-red-500' : 'text-gray-500'}
        />
        <StatCard
          label="Resolved This Month"
          value={dashboard?.resolvedThisMonth || 0}
          icon={CheckCircle}
          iconColor="text-green-500"
        />
      </div>

      {/* Severity Summary */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Minor</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">
              {dashboard.bySeverity.minor}
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase font-medium">Major</p>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
              {dashboard.bySeverity.major}
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400 uppercase font-medium">Critical</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200">
              {dashboard.bySeverity.critical}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Status:</label>
          <DxSelectBox
            items={statusOptions}
            value={statusFilter || null}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setStatusFilter(value as ComplaintStatus | undefined)}
            width={180}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Category:</label>
          <DxSelectBox
            items={categoryOptions}
            value={categoryFilter || null}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setCategoryFilter(value as ComplaintCategory | undefined)}
            width={150}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Severity:</label>
          <DxSelectBox
            items={severityOptions}
            value={severityFilter || null}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setSeverityFilter(value as ComplaintSeverity | undefined)}
            width={150}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Complaint List */}
        <div className="lg:col-span-2">
          <ComplaintList
            status={statusFilter}
            category={categoryFilter}
            severity={severityFilter}
            onComplaintSelect={handleComplaintSelect}
            onNewComplaint={handleNewComplaint}
          />
        </div>

        {/* Trends Chart */}
        <div className="lg:col-span-1">
          <ComplaintTrendsChart />
        </div>
      </div>
    </div>
  );
}
