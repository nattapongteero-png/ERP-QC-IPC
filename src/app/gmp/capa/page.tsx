'use client';

/**
 * CAPA List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Main page for viewing and managing CAPAs.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CapaList } from '@/components/capa';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { FileCheck, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Capa, CapaStatus, CapaPriority, CapaDashboard } from '@/types/capa';

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<CapaDashboard> {
  const response = await fetch('/api/capa/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export default function CapaListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<CapaStatus | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<CapaPriority | undefined>(undefined);

  // Fetch dashboard statistics
  const { data: dashboard } = useQuery({
    queryKey: ['capa-dashboard'],
    queryFn: fetchDashboard,
  });

  // Handlers
  const handleCapaSelect = (capa: Capa) => {
    router.push(`/gmp/capa/${capa.id}`);
  };

  const handleNewCapa = () => {
    router.push('/gmp/capa/new');
  };

  // Status filter options
  const statusOptions = [
    { value: null, label: 'All Statuses' },
    { value: 'open', label: 'Open' },
    { value: 'investigation', label: 'Investigation' },
    { value: 'action_pending', label: 'Action Pending' },
    { value: 'verification', label: 'Verification' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // Priority filter options
  const priorityOptions = [
    { value: null, label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="CAPA Management"
        subtitle="Corrective and Preventive Actions (หมวด 1)"
        actions={
          <DxButton
            text="New CAPA"
            icon="add"
            type="success"
            onClick={handleNewCapa}
          />
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open CAPAs"
          value={dashboard?.totalOpen || 0}
          icon={FileCheck}
          iconColor="text-blue-500"
        />
        <StatCard
          label="Overdue"
          value={dashboard?.overdue || 0}
          icon={AlertTriangle}
          iconColor={dashboard?.overdue && dashboard.overdue > 0 ? 'text-red-500' : 'text-gray-500'}
        />
        <StatCard
          label="Closed This Month"
          value={dashboard?.closedThisMonth || 0}
          icon={CheckCircle}
          iconColor="text-green-500"
        />
        <StatCard
          label="Effectiveness Rate"
          value={`${dashboard?.effectivenessRate || 0}%`}
          icon={Clock}
          iconColor="text-purple-500"
        />
      </div>

      {/* Priority Summary */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Low Priority</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">{dashboard.byPriority.low}</p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase font-medium">Medium Priority</p>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{dashboard.byPriority.medium}</p>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-xs text-orange-600 dark:text-orange-400 uppercase font-medium">High Priority</p>
            <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{dashboard.byPriority.high}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400 uppercase font-medium">Critical</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200">{dashboard.byPriority.critical}</p>
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
            onValueChange={(value) => setStatusFilter(value as CapaStatus | undefined)}
            width={150}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Priority:</label>
          <DxSelectBox
            items={priorityOptions}
            value={priorityFilter || null}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setPriorityFilter(value as CapaPriority | undefined)}
            width={150}
          />
        </div>
      </div>

      {/* CAPA List */}
      <CapaList
        status={statusFilter}
        priority={priorityFilter}
        onCapaSelect={handleCapaSelect}
        onNewCapa={handleNewCapa}
      />
    </div>
  );
}
