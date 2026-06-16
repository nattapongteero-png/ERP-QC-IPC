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
      toast.success('กำหนดการตรวจประเมินเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      setShowCreatePopup(false);
      // Remove new param from URL
      router.replace('/gmp/internal-audit/audits');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'ไม่สามารถกำหนดการตรวจประเมินได้');
    },
  });

  const startMutation = useMutation({
    mutationFn: startAudit,
    onSuccess: () => {
      toast.success('เริ่มการตรวจประเมินแล้ว');
      queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'ไม่สามารถเริ่มการตรวจประเมินได้');
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeAudit,
    onSuccess: () => {
      toast.success('การตรวจประเมินเสร็จสิ้นแล้ว');
      queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'ไม่สามารถปิดการตรวจประเมินได้');
    },
  });

  const handleCreate = () => {
    if (!formData.scope.trim()) {
      toast.error('กรุณาระบุขอบเขตการตรวจประเมิน');
      return;
    }
    if (formData.gmpChapters.length === 0) {
      toast.error('กรุณาเลือกหมวด GMP อย่างน้อยหนึ่งหมวด');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleView = (audit: Audit) => {
    router.push(`/gmp/internal-audit/audits/${audit.id}`);
  };

  const handleStart = (auditId: number) => {
    if (confirm('คุณต้องการเริ่มการตรวจประเมินนี้ใช่หรือไม่?')) {
      startMutation.mutate(auditId);
    }
  };

  const handleComplete = (auditId: number) => {
    if (confirm('คุณต้องการปิดการตรวจประเมินนี้ใช่หรือไม่?')) {
      completeMutation.mutate(auditId);
    }
  };

  const auditTypeOptions = [
    { id: 'internal', name: 'การตรวจประเมินภายใน' },
    { id: 'external', name: 'การตรวจประเมินภายนอก' },
    { id: 'regulatory', name: 'การตรวจประเมินตามกฎระเบียบ' },
  ];

  const chapterOptions = Object.entries(GMP_CHAPTERS).map(([id, name]) => ({
    id: parseInt(id),
    name: `หมวด ${id}: ${name}`,
  }));

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-red-600">เกิดข้อผิดพลาดในการโหลดการตรวจประเมิน: {(error as Error).message}</p>
          <DxButton
            text="ลองใหม่"
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
        subtitle={planId ? `การตรวจประเมินสำหรับแผน #${planId}` : t('internalAudit.audits.description')}
        onBack={() => router.push('/gmp/internal-audit')}
        actions={
          <DxButton
            text="กำหนดการตรวจประเมิน"
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
        title="กำหนดการตรวจประเมิน"
        width={600}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ประเภทการตรวจประเมิน *</label>
              <DxSelectBox
                value={formData.auditType}
                onValueChanged={(e) => setFormData({ ...formData, auditType: e.value })}
                dataSource={auditTypeOptions}
                valueExpr="id"
                displayExpr="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">วันที่กำหนดตรวจประเมิน *</label>
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
            <label className="block text-sm font-medium mb-1">ขอบเขตการตรวจประเมิน *</label>
            <DxTextBox
              value={formData.scope}
              onValueChanged={(e) => setFormData({ ...formData, scope: e.value })}
              placeholder="เช่น พื้นที่การผลิต, ห้องปฏิบัติการควบคุมคุณภาพ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">หมวด GMP *</label>
            <DxTagBox
              value={formData.gmpChapters}
              onValueChanged={(e) => setFormData({ ...formData, gmpChapters: e.value })}
              dataSource={chapterOptions}
              valueExpr="id"
              displayExpr="name"
              placeholder="เลือกหมวด GMP ที่ต้องการตรวจประเมิน"
              showSelectionControls
              applyValueMode="useButtons"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">วัตถุประสงค์</label>
            <DxTextArea
              value={formData.objectives}
              onValueChanged={(e) => setFormData({ ...formData, objectives: e.value })}
              placeholder="กรอกวัตถุประสงค์ของการตรวจประเมิน"
              height={100}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="ยกเลิก"
              onClick={() => {
                setShowCreatePopup(false);
                router.replace('/gmp/internal-audit/audits');
              }}
              stylingMode="outlined"
            />
            <DxButton
              text="กำหนดการตรวจประเมิน"
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
