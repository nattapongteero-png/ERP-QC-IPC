'use client';

/**
 * Create Stability Study Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Form to enroll a batch (lot) into an approved stability protocol.
 * Matches studyCreateSchema: protocolId, lotId, startDate (required),
 * chamberLocation, notes (optional).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import type { StabilityStudy, StabilityStudyCreate } from '@/types/stability';

// ============================================
// API Functions
// ============================================

interface ProtocolResponse {
  id: number;
  protocolNumber: string;
  name: string;
  productName?: string;
  storageCondition: string;
  status: string;
}

interface ProtocolOption {
  id: number;
  label: string;
  [key: string]: unknown;
}

async function fetchApprovedProtocols(): Promise<ProtocolOption[]> {
  // Only approved protocols may have studies enrolled (enforced server-side).
  const response = await fetch('/api/stability/protocols?status=approved');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return (result.data as ProtocolResponse[]).map((p) => ({
    id: p.id,
    label: `${p.protocolNumber} — ${p.name}${p.productName ? ` (${p.productName})` : ''}`,
  }));
}

interface LotResponse {
  id: number;
  lotNumber: string;
  batchNumber: string | null;
  itemName: string | null;
  itemCode: string | null;
}

interface LotOption {
  id: number;
  label: string;
  [key: string]: unknown;
}

async function fetchLots(): Promise<LotOption[]> {
  const response = await fetch('/api/inventory/lots?limit=200');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  const items: LotResponse[] = result.data?.items ?? [];
  return items.map((lot) => ({
    id: lot.id,
    label: `${lot.lotNumber}${lot.itemName ? ` — ${lot.itemName}` : ''}${
      lot.itemCode ? ` (${lot.itemCode})` : ''
    }`,
  }));
}

async function createStudy(data: StabilityStudyCreate): Promise<StabilityStudy> {
  const response = await fetch('/api/stability/studies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'ไม่สามารถสร้างการศึกษาได้');
  return result.data as StabilityStudy;
}

// ============================================
// Component
// ============================================

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function NewStudyPage() {
  const router = useRouter();

  // Form state
  const [protocolId, setProtocolId] = useState<number | null>(null);
  const [lotId, setLotId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>(todayStr());
  const [chamberLocation, setChamberLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch approved protocols
  const { data: protocols, isLoading: protocolsLoading } = useQuery({
    queryKey: ['stability-protocols', 'approved'],
    queryFn: fetchApprovedProtocols,
  });

  // Fetch lots
  const { data: lots, isLoading: lotsLoading } = useQuery({
    queryKey: ['inventory-lots', 'stability-enroll'],
    queryFn: fetchLots,
  });

  // Create study mutation
  const createMutation = useMutation({
    mutationFn: createStudy,
    onSuccess: (study) => {
      setSuccessMsg(`สร้างการศึกษา ${study.studyNumber} สำเร็จ`);
      router.push(`/gmp/stability/studies/${study.id}`);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'ไม่สามารถสร้างการศึกษาได้');
    },
  });

  // Validation
  const canSubmit = (): boolean => {
    if (!protocolId || !lotId || !startDate) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return false;
    return true;
  };

  const handleSubmit = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!canSubmit()) {
      setErrorMsg('กรุณากรอกข้อมูลที่จำเป็นทั้งหมด (โปรโตคอล, ล็อต และวันที่เริ่มต้น)');
      return;
    }

    const data: StabilityStudyCreate = {
      protocolId: protocolId!,
      lotId: lotId!,
      startDate,
      chamberLocation: chamberLocation.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    createMutation.mutate(data);
  };

  const cancel = () => router.push('/gmp/stability/studies');

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="สร้างการศึกษาความคงตัวใหม่"
        subtitle="ลงทะเบียนแบทช์ (ล็อต) เข้าสู่โปรโตคอลความคงตัวที่อนุมัติแล้ว"
        onBack={cancel}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text="ยกเลิก"
              onClick={cancel}
              stylingMode="outlined"
            />
            <DxButton
              text="บันทึกการศึกษา"
              icon="save"
              onClick={handleSubmit}
              type="default"
              disabled={!canSubmit() || createMutation.isPending}
            />
          </div>
        }
      />

      {/* Success / Error banners */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{errorMsg}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-card border rounded-lg shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-emerald-700 dark:text-emerald-400">
            ข้อมูลการศึกษา
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Protocol */}
            <div>
              <label className="block text-sm font-medium mb-2">โปรโตคอล *</label>
              <DxSelectBox
                dataSource={protocols || []}
                valueExpr="id"
                displayExpr="label"
                value={protocolId}
                onValueChanged={(e) => setProtocolId(e.value ?? null)}
                placeholder={
                  protocolsLoading ? 'กำลังโหลด...' : 'เลือกโปรโตคอลที่อนุมัติแล้ว...'
                }
                searchEnabled={true}
                showClearButton={true}
                disabled={protocolsLoading}
              />
              {protocols && protocols.length === 0 && !protocolsLoading && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ยังไม่มีโปรโตคอลที่อนุมัติแล้ว กรุณาอนุมัติโปรโตคอลก่อน
                </p>
              )}
            </div>

            {/* Lot */}
            <div>
              <label className="block text-sm font-medium mb-2">ล็อต / แบทช์ *</label>
              <DxSelectBox
                dataSource={lots || []}
                valueExpr="id"
                displayExpr="label"
                value={lotId}
                onValueChanged={(e) => setLotId(e.value ?? null)}
                placeholder={lotsLoading ? 'กำลังโหลด...' : 'เลือกล็อต...'}
                searchEnabled={true}
                showClearButton={true}
                disabled={lotsLoading}
              />
            </div>

            {/* Start date */}
            <div>
              <label className="block text-sm font-medium mb-2">วันที่เริ่มต้น *</label>
              <DxDateBox
                value={startDate}
                onValueChange={(v) => setStartDate(v)}
                type="date"
                placeholder="เลือกวันที่เริ่มต้น..."
                showClearButton={false}
              />
            </div>

            {/* Chamber location */}
            <div>
              <label className="block text-sm font-medium mb-2">ตำแหน่งห้องเก็บ</label>
              <DxTextBox
                value={chamberLocation}
                onValueChange={(v) => setChamberLocation(v)}
                placeholder="เช่น Chamber A-1 (ไม่บังคับ)"
                maxLength={100}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">หมายเหตุ</label>
          <DxTextArea
            value={notes}
            onValueChange={(v) => setNotes(v)}
            placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
            maxLength={1000}
            height={100}
          />
        </div>

        {/* Validation hint */}
        {!canSubmit() && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              กรุณาเลือกโปรโตคอล, ล็อต และระบุวันที่เริ่มต้นเพื่อบันทึก
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
