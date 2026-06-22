'use client';

/**
 * Audits List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * View and manage internal audits.
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { AuditList } from '@/components/internal-audit';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import { useToast } from '@/components/ui/toast';
import type { Audit, AuditType } from '@/types/audits';
import { GMP_CHAPTERS } from '@/types/audits';

// ============================================
// API Functions
// ============================================

interface AuditsResponse {
  audits: Audit[];
  total: number;
}

async function fetchAudits(planId?: number): Promise<AuditsResponse> {
  const params = new URLSearchParams();
  if (planId) params.set('planId', planId.toString());
  const response = await fetch(`/api/internal-audit/audits?${params}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createAudit(data: {
  planId?: number;
  auditType: AuditType;
  scope: string;
  gmpChapters: number[];
  scheduledDate: string;
  objectives?: string;
}): Promise<Audit> {
  const response = await fetch('/api/internal-audit/audits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function startAudit(auditId: number): Promise<void> {
  const response = await fetch(`/api/internal-audit/audits/${auditId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

async function completeAudit(auditId: number): Promise<void> {
  const response = await fetch(`/api/internal-audit/audits/${auditId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
}

// ============================================
// Inner Component (with useSearchParams)
// ============================================

function AuditsPageContent() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const planId = searchParams.get('planId') ? parseInt(searchParams.get('planId')!) : undefined;
  const showNew = searchParams.get('new') === '1';

  const [showCreatePopup, setShowCreatePopup] = useState(showNew);
  const [formData, setFormData] = useState({
    planId: planId,
    auditType: 'internal' as AuditType,
    scope: '',
    gmpChapters: [] as number[],
    scheduledDate: new Date().toISOString().split('T')[0],
    objectives: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audits', planId],
    queryFn: () => fetchAudits(planId),
  });

  const createMutation = useMutation({
    mutationFn: createAudit,
    onSuccess: () => {
      toast.success(t('internalAudit.auditsList.toast.create.success'));
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      setShowCreatePopup(false);
      // Remove new param from URL
      router.replace('/gmp/internal-audit/audits');
    },
    onError: (err: Error) => {
      toast.error(err.message || t('internalAudit.auditsList.toast.create.error'));
    },
  });

  const startMutation = useMutation({
    mutationFn: startAudit,
    onSuccess: () => {
      toast.success(t('internalAudit.auditsList.toast.start.success'));
      queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('internalAudit.auditsList.toast.start.error'));
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeAudit,
    onSuccess: () => {
      toast.success(t('internalAudit.auditsList.toast.complete.success'));
      queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('internalAudit.auditsList.toast.complete.error'));
    },
  });

  const handleCreate = () => {
    if (!formData.scope.trim()) {
      toast.error(t('internalAudit.auditsList.validation.scopeRequired'));
      return;
    }
    if (formData.gmpChapters.length === 0) {
      toast.error(t('internalAudit.auditsList.validation.chaptersRequired'));
      return;
    }
    createMutation.mutate(formData);
  };

  const handleView = (audit: Audit) => {
    router.push(`/gmp/internal-audit/audits/${audit.id}`);
  };

  const handleStart = (auditId: number) => {
    if (confirm(t('internalAudit.auditsList.confirm.start'))) {
      startMutation.mutate(auditId);
    }
  };

  const handleComplete = (auditId: number) => {
    if (confirm(t('internalAudit.auditsList.confirm.complete'))) {
      completeMutation.mutate(auditId);
    }
  };

  const auditTypeOptions = [
    { id: 'internal', name: t('internalAudit.auditsList.auditTypes.internal') },
    { id: 'external', name: t('internalAudit.auditsList.auditTypes.external') },
    { id: 'regulatory', name: t('internalAudit.auditsList.auditTypes.regulatory') },
  ];

  const chapterOptions = Object.entries(GMP_CHAPTERS).map(([id, name]) => ({
    id: parseInt(id),
    name: t('internalAudit.auditsList.chapterLabel', { chapter: id, name }),
  }));

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-red-600">{t('internalAudit.auditsList.loadError')}: {(error as Error).message}</p>
          <DxButton
            text={t('common.retry')}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['audits'] })}
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('internalAudit.audits.title')}
        subtitle={planId ? t('internalAudit.auditsList.subtitleForPlan', { planId }) : t('internalAudit.audits.description')}
        onBack={() => router.push('/gmp/internal-audit')}
        actions={
          <DxButton
            text={t('internalAudit.auditsList.scheduleAudit')}
            icon="plus"
            onClick={() => setShowCreatePopup(true)}
            type="default"
          />
        }
      />

      {/* Audits List */}
      <div className="bg-card border rounded-lg p-6">
        <AuditList
          audits={data?.audits || []}
          onView={handleView}
          onStart={handleStart}
          onComplete={handleComplete}
          canEdit={true}
          loading={isLoading}
        />
      </div>

      {/* Create Audit Popup */}
      <DxPopup
        visible={showCreatePopup}
        onHiding={() => {
          setShowCreatePopup(false);
          router.replace('/gmp/internal-audit/audits');
        }}
        title={t('internalAudit.auditsList.scheduleAudit')}
        width={600}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('internalAudit.auditsList.form.auditType')}</label>
              <DxSelectBox
                value={formData.auditType}
                onValueChanged={(e) => setFormData({ ...formData, auditType: e.value })}
                dataSource={auditTypeOptions}
                valueExpr="id"
                displayExpr="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('internalAudit.auditsList.form.scheduledDate')}</label>
              <DxDateBox
                value={formData.scheduledDate}
                onValueChanged={(e) =>
                  setFormData({ ...formData, scheduledDate: e.value?.toISOString().split('T')[0] || '' })
                }
                type="date"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('internalAudit.auditsList.form.scope')}</label>
            <DxTextBox
              value={formData.scope}
              onValueChanged={(e) => setFormData({ ...formData, scope: e.value })}
              placeholder={t('internalAudit.auditsList.form.scopePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('internalAudit.auditsList.form.gmpChapters')}</label>
            <DxTagBox
              value={formData.gmpChapters}
              onValueChanged={(e) => setFormData({ ...formData, gmpChapters: e.value })}
              dataSource={chapterOptions}
              valueExpr="id"
              displayExpr="name"
              placeholder={t('internalAudit.auditsList.form.gmpChaptersPlaceholder')}
              showSelectionControls
              applyValueMode="useButtons"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('internalAudit.auditsList.form.objectives')}</label>
            <DxTextArea
              value={formData.objectives}
              onValueChanged={(e) => setFormData({ ...formData, objectives: e.value })}
              placeholder={t('internalAudit.auditsList.form.objectivesPlaceholder')}
              height={100}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text={t('common.cancel')}
              onClick={() => {
                setShowCreatePopup(false);
                router.replace('/gmp/internal-audit/audits');
              }}
              stylingMode="outlined"
            />
            <DxButton
              text={t('internalAudit.auditsList.scheduleAudit')}
              onClick={handleCreate}
              type="default"
              disabled={createMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

// ============================================
// Page Component with Suspense
// ============================================

export default function AuditsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      }
    >
      <AuditsPageContent />
    </Suspense>
  );
}
