'use client';

/**
 * Complaint Investigation Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Form for QC to record investigation findings and route complaints.
 */

import { useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlaskConical, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';
import type { ComplaintDetails, ComplaintInvestigation } from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintInvestigationFormProps {
  complaint: ComplaintDetails;
  onInvestigationStarted?: (investigation: ComplaintInvestigation) => void;
  onInvestigationRecorded?: (investigation: ComplaintInvestigation) => void;
}

interface InvestigationFormData {
  batchRecordReview: string;
  retainSampleTest: string;
  rootCause: string;
  conclusion: string;
  recommendation: string;
}

// ============================================
// API Functions
// ============================================

async function fetchQCUsers(): Promise<{ id: number; displayName: string }[]> {
  const response = await fetch('/api/users?role=qc');
  const result = await response.json();
  if (!result.success) return [];
  // API returns paginated response with items array
  const users = result.data?.items || result.data || [];
  // Map users to expected format with displayName
  return Array.isArray(users)
    ? users.map((u: { id: number; name: string }) => ({ id: u.id, displayName: u.name }))
    : [];
}

async function routeToQC(complaintId: number, investigatorId: number): Promise<ComplaintInvestigation> {
  const response = await fetch(`/api/complaints/${complaintId}/route-to-qc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ investigatorId }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'ไม่สามารถส่งต่อข้อร้องเรียนได้');
  }
  return result.data;
}

async function recordInvestigation(
  complaintId: number,
  data: InvestigationFormData
): Promise<ComplaintInvestigation> {
  const response = await fetch(`/api/complaints/${complaintId}/investigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'ไม่สามารถบันทึกการสอบสวนได้');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function ComplaintInvestigationForm({
  complaint,
  onInvestigationStarted,
  onInvestigationRecorded,
}: ComplaintInvestigationFormProps) {
  const [selectedInvestigatorId, setSelectedInvestigatorId] = useState<number | null>(null);
  const [formData, setFormData] = useState<InvestigationFormData>({
    batchRecordReview: complaint.investigation?.batchRecordReview || '',
    retainSampleTest: complaint.investigation?.retainSampleTest || '',
    rootCause: complaint.investigation?.rootCause || '',
    conclusion: complaint.investigation?.conclusion || '',
    recommendation: complaint.investigation?.recommendation || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch QC users
  const { data: qcUsers } = useQuery({
    queryKey: ['qc-users'],
    queryFn: fetchQCUsers,
  });

  // Route to QC mutation
  const routeMutation = useMutation({
    mutationFn: () => routeToQC(complaint.id, selectedInvestigatorId!),
    onSuccess: (data) => {
      onInvestigationStarted?.(data);
    },
    onError: (error) => {
      setErrors({ route: error.message });
    },
  });

  // Record investigation mutation
  const recordMutation = useMutation({
    mutationFn: () => recordInvestigation(complaint.id, formData),
    onSuccess: (data) => {
      onInvestigationRecorded?.(data);
    },
    onError: (error) => {
      setErrors({ record: error.message });
    },
  });

  // Validate investigation form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.rootCause.trim()) {
      newErrors.rootCause = 'กรุณาระบุสาเหตุที่แท้จริง';
    }
    if (!formData.conclusion.trim()) {
      newErrors.conclusion = 'กรุณาระบุข้อสรุป';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle route to QC
  const handleRouteToQC = () => {
    if (!selectedInvestigatorId) {
      setErrors({ route: 'กรุณาเลือกผู้ตรวจสอบ' });
      return;
    }
    routeMutation.mutate();
  };

  // Handle record investigation
  const handleRecordInvestigation = () => {
    if (!validate()) return;
    recordMutation.mutate();
  };

  const isRouting = routeMutation.isPending;
  const isRecording = recordMutation.isPending;

  // Show route to QC form if status is 'received'
  if (complaint.status === 'received') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">ส่งต่อให้ฝ่าย QC</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          มอบหมายข้อร้องเรียนนี้ให้ผู้ตรวจสอบฝ่าย QC เพื่อวิเคราะห์หาสาเหตุที่แท้จริง
        </p>

        {errors.route && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {errors.route}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            มอบหมายผู้ตรวจสอบ <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={(qcUsers || []).map((u) => ({ value: u.id, label: u.displayName }))}
            value={selectedInvestigatorId}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setSelectedInvestigatorId(value)}
            placeholder="เลือกผู้ตรวจสอบฝ่าย QC"
          />
        </div>

        <DxButton
          text="ส่งต่อให้ฝ่าย QC"
          icon="user"
          onClick={handleRouteToQC}
          type="default"
          disabled={isRouting || !selectedInvestigatorId}
        />
      </div>
    );
  }

  // Show investigation form if status is 'under_investigation'
  if (complaint.status === 'under_investigation') {
    const investigation = complaint.investigation;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">การสอบสวน</h3>
        </div>

        {investigation && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4" />
              <span>ผู้ตรวจสอบ: {investigation.investigatorName || 'ไม่ทราบ'}</span>
            </div>
            <div className="text-muted-foreground">
              เริ่มเมื่อ: {investigation.startDate}
            </div>
          </div>
        )}

        {errors.record && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {errors.record}
          </div>
        )}

        {/* Batch Record Review */}
        <div className="space-y-2">
          <label className="text-sm font-medium">การทบทวนบันทึกการผลิตล็อต</label>
          <DxTextArea
            value={formData.batchRecordReview}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, batchRecordReview: value || '' }))}
            placeholder="บันทึกสิ่งที่พบจากการทบทวนบันทึกการผลิตล็อต..."
            height={80}
          />
        </div>

        {/* Retain Sample Test */}
        <div className="space-y-2">
          <label className="text-sm font-medium">ผลการทดสอบตัวอย่างเก็บกัน</label>
          <DxTextArea
            value={formData.retainSampleTest}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, retainSampleTest: value || '' }))}
            placeholder="บันทึกผลการทดสอบจากตัวอย่างที่เก็บกันไว้..."
            height={80}
          />
        </div>

        {/* Root Cause */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            สาเหตุที่แท้จริง <span className="text-destructive">*</span>
          </label>
          <DxTextArea
            value={formData.rootCause}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, rootCause: value || '' }))}
            placeholder="อธิบายสาเหตุที่แท้จริงที่พบ..."
            height={100}
          />
          {errors.rootCause && (
            <p className="text-sm text-destructive">{errors.rootCause}</p>
          )}
        </div>

        {/* Conclusion */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            ข้อสรุป <span className="text-destructive">*</span>
          </label>
          <DxTextArea
            value={formData.conclusion}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, conclusion: value || '' }))}
            placeholder="ระบุข้อสรุปของการสอบสวน..."
            height={100}
          />
          {errors.conclusion && (
            <p className="text-sm text-destructive">{errors.conclusion}</p>
          )}
        </div>

        {/* Recommendation */}
        <div className="space-y-2">
          <label className="text-sm font-medium">ข้อเสนอแนะ</label>
          <DxTextArea
            value={formData.recommendation}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, recommendation: value || '' }))}
            placeholder="เสนอแนะการดำเนินการแก้ไข/ป้องกัน..."
            height={80}
          />
        </div>

        <DxButton
          text="เสร็จสิ้นการสอบสวน"
          icon="check"
          onClick={handleRecordInvestigation}
          type="success"
          disabled={isRecording}
        />
      </div>
    );
  }

  // Show completed investigation summary
  if (complaint.investigation) {
    const inv = complaint.investigation;
    const isCompleted = !!inv.completionDate;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
          <h3 className="text-lg font-semibold">
            การสอบสวน {isCompleted ? 'เสร็จสิ้น' : 'กำลังดำเนินการ'}
          </h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-muted-foreground">ผู้ตรวจสอบ</p>
              <p>{inv.investigatorName || 'ไม่ทราบ'}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">เริ่มเมื่อ</p>
              <p>{inv.startDate}</p>
            </div>
            {inv.completionDate && (
              <div>
                <p className="font-medium text-muted-foreground">เสร็จสิ้นเมื่อ</p>
                <p>{inv.completionDate}</p>
              </div>
            )}
          </div>

          {inv.rootCause && (
            <div>
              <p className="font-medium text-muted-foreground">สาเหตุที่แท้จริง</p>
              <p className="whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">{inv.rootCause}</p>
            </div>
          )}

          {inv.conclusion && (
            <div>
              <p className="font-medium text-muted-foreground">ข้อสรุป</p>
              <p className="whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">{inv.conclusion}</p>
            </div>
          )}

          {inv.recommendation && (
            <div>
              <p className="font-medium text-muted-foreground">ข้อเสนอแนะ</p>
              <p className="whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">{inv.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
