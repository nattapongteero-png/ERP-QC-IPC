'use client';

/**
 * Stability Study Detail Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Detailed view of a stability study with samples and trends.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StabilitySampleSchedule,
  StabilityTrendChart,
} from '@/components/stability';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import {
  FlaskConical,
  Calendar,
  MapPin,
  Package,
  User,
  FileText,
} from 'lucide-react';
import type { StabilityStudyDetails, StudyTrendData } from '@/types/stability';

// ============================================
// API Functions
// ============================================

async function fetchStudyDetails(id: number): Promise<StabilityStudyDetails> {
  const response = await fetch(`/api/stability/studies/${id}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchStudyTrends(id: number): Promise<StudyTrendData> {
  const response = await fetch(`/api/stability/trends/${id}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function updateStudyStatus(id: number, status: string): Promise<void> {
  const response = await fetch(`/api/stability/studies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

// ============================================
// Component
// ============================================

export default function StabilityStudyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const studyId = Number(params.id);

  const [activeTab, setActiveTab] = useState(0);

  // Fetch study details
  const {
    data: study,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['stability-study', studyId],
    queryFn: () => fetchStudyDetails(studyId),
    enabled: !!studyId && !isNaN(studyId),
  });

  // Fetch trends
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['stability-trends', studyId],
    queryFn: () => fetchStudyTrends(studyId),
    enabled: !!studyId && !isNaN(studyId),
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => updateStudyStatus(studyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stability-study', studyId] });
      queryClient.invalidateQueries({ queryKey: ['stability-studies'] });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load study</p>
          <DxButton text="Go Back" onClick={() => router.back()} stylingMode="outlined" />
        </div>
      </div>
    );
  }

  const isActive = study.status === 'active';
  const canComplete = isActive && study.samples.every((s) => s.status !== 'pending');

  // Calculate progress
  const testedCount = study.samples.filter((s) => s.status === 'tested').length;
  const totalSamples = study.samples.length;
  const progressPercent = totalSamples > 0 ? (testedCount / totalSamples) * 100 : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={`Study ${study.studyNumber}`}
        subtitle={study.productName || 'Unknown Product'}
        onBack={() => router.push('/gmp/stability/studies')}
        actions={
          <div className="flex items-center gap-2">
            {study.status === 'active' && (
              <DxButton
                text="Put On Hold"
                onClick={() => updateStatusMutation.mutate('on_hold')}
                stylingMode="outlined"
                disabled={updateStatusMutation.isPending}
              />
            )}
            {study.status === 'on_hold' && (
              <DxButton
                text="Resume"
                onClick={() => updateStatusMutation.mutate('active')}
                type="default"
                disabled={updateStatusMutation.isPending}
              />
            )}
            {canComplete && (
              <DxButton
                text="Complete Study"
                icon="check"
                onClick={() => updateStatusMutation.mutate('completed')}
                type="success"
                disabled={updateStatusMutation.isPending}
              />
            )}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Study Info */}
        <div className="lg:col-span-2 bg-card border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FlaskConical className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{study.studyNumber}</h2>
                <p className="text-sm text-muted-foreground">{study.protocolNumber}</p>
              </div>
            </div>
            <WorkflowStatusBadge status={study.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Lot: {study.lotNumber || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Start: {study.startDate}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Chamber: {study.chamberLocation || 'Not assigned'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Created by: {study.createdByName || 'Unknown'}</span>
            </div>
          </div>

          {/* Protocol Info */}
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={() => router.push(`/gmp/stability/protocols/${study.protocolId}`)}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
              <span>View Protocol: {study.protocol?.name}</span>
            </button>
            <p className="text-sm text-muted-foreground mt-1">
              {study.protocol?.studyType.replace('_', ' ')} - {study.protocol?.storageCondition}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Study Progress</h3>

          <div className="flex items-center justify-center mb-4">
            <div className="text-5xl font-bold text-blue-600">
              {progressPercent.toFixed(0)}%
            </div>
          </div>

          <div className="w-full bg-muted rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold">{testedCount}</div>
              <div className="text-xs text-muted-foreground">Tested</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xl font-bold">{totalSamples - testedCount}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>

          {study.oosCount > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <div className="text-xl font-bold text-red-600">{study.oosCount}</div>
              <div className="text-xs text-red-600">OOS Detected</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border rounded-lg shadow-sm">
        <DxTabs
          items={[
            { id: 0, text: 'Sample Schedule', icon: 'clock' },
            { id: 1, text: 'Trends', icon: 'chart' },
          ] as DxTabItem[]}
          selectedIndex={activeTab}
          onSelectedIndexChange={setActiveTab}
        />

        <div className="p-6">
          {activeTab === 0 && (
            <StabilitySampleSchedule
              studyId={studyId}
              samples={study.samples}
              canEdit={isActive}
            />
          )}
          {activeTab === 1 && (
            <StabilityTrendChart data={trends || null} loading={trendsLoading} />
          )}
        </div>
      </div>
    </div>
  );
}
