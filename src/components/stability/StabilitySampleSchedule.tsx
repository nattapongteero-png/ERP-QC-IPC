'use client';

/**
 * Stability Sample Schedule Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Shows sample schedule for a study with status and actions.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import {
  Clock,
  FlaskConical,
  CheckCircle,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import type { StabilitySample, StabilitySampleStatus, RecordTestRequest } from '@/types/stability';

interface StabilitySampleScheduleProps {
  studyId: number;
  samples: StabilitySample[];
  canEdit?: boolean;
}

const statusConfig: Record<
  StabilitySampleStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'รอดำเนินการ',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    icon: <Clock className="h-3 w-3" />,
  },
  sampled: {
    label: 'เก็บตัวอย่างแล้ว',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: <FlaskConical className="h-3 w-3" />,
  },
  tested: {
    label: 'ทดสอบแล้ว',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  skipped: {
    label: 'ข้าม',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: <SkipForward className="h-3 w-3" />,
  },
};

async function recordSampleTest(
  sampleId: number,
  data: RecordTestRequest
): Promise<StabilitySample> {
  const response = await fetch(`/api/stability/samples/${sampleId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export function StabilitySampleSchedule({
  studyId,
  samples,
  canEdit = true,
}: StabilitySampleScheduleProps) {
  const queryClient = useQueryClient();
  const [testDialogSample, setTestDialogSample] = useState<StabilitySample | null>(null);
  const [testData, setTestData] = useState<RecordTestRequest>({
    qualityTestId: 0,
    oosDetected: false,
    notes: '',
  });

  const recordTestMutation = useMutation({
    mutationFn: (data: { sampleId: number; testData: RecordTestRequest }) =>
      recordSampleTest(data.sampleId, data.testData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stability-study', studyId] });
      setTestDialogSample(null);
      setTestData({ qualityTestId: 0, oosDetected: false, notes: '' });
    },
  });

  const handleRecordTest = () => {
    if (!testDialogSample || !testData.qualityTestId) return;
    recordTestMutation.mutate({
      sampleId: testDialogSample.id,
      testData,
    });
  };

  const renderStatusCell = (cellData: { value: StabilitySampleStatus }) => {
    const config = statusConfig[cellData.value];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const renderTimepointCell = (cellData: { value: number }) => {
    return <span className="font-medium">{cellData.value}M</span>;
  };

  const renderScheduledDateCell = (cellData: { data: StabilitySample }) => {
    const sample = cellData.data;
    if (!sample.scheduledDate) return '-';

    const scheduled = new Date(sample.scheduledDate);
    const today = new Date();
    const daysUntil = Math.floor(
      (scheduled.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (sample.status === 'pending' && daysUntil < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{sample.scheduledDate}</span>
        </div>
      );
    }
    return sample.scheduledDate;
  };

  const renderOOSCell = (cellData: { data: StabilitySample }) => {
    const sample = cellData.data;
    if (sample.status !== 'tested') return '-';

    if (sample.oosDetected) {
      // T713: Link to deviation if exists
      if (sample.oosInvestigationId) {
        return (
          <a
            href={`/gmp/quality/deviations/${sample.oosInvestigationId}`}
            className="inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <AlertTriangle className="h-3 w-3" />
            <span>ใช่ (DEV)</span>
          </a>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
          <AlertTriangle className="h-3 w-3" />
          <span>ใช่</span>
        </span>
      );
    }

    return <span className="text-green-600">ไม่</span>;
  };

  const renderActionsCell = (cellData: { data: StabilitySample }) => {
    if (!canEdit) return null;
    const sample = cellData.data;

    if (sample.status === 'pending' || sample.status === 'sampled') {
      return (
        <DxButton
          text="บันทึกผลทดสอบ"
          stylingMode="text"
          onClick={() => setTestDialogSample(sample)}
        />
      );
    }
    return null;
  };

  return (
    <>
      <DxDataGrid dataSource={samples} showBorders rowAlternationEnabled>
        <DxPaging defaultPageSize={20} />

        <DxColumn
          dataField="timepoint"
          caption="จุดเวลา"
          width={100}
          cellRender={renderTimepointCell}
        />
        <DxColumn dataField="sampleNumber" caption="เลขตัวอย่าง" width={120} />
        <DxColumn
          caption="กำหนดการ"
          width={120}
          cellRender={renderScheduledDateCell}
          allowSorting={false}
        />
        <DxColumn
          dataField="actualDate"
          caption="วันที่จริง"
          dataType="date"
          width={110}
        />
        <DxColumn
          dataField="status"
          caption="สถานะ"
          width={100}
          cellRender={renderStatusCell}
        />
        <DxColumn
          caption="OOS"
          width={70}
          cellRender={renderOOSCell}
          allowFiltering={false}
          allowSorting={false}
        />
        <DxColumn dataField="sampledByName" caption="ผู้เก็บตัวอย่าง" width={120} />
        <DxColumn dataField="notes" caption="หมายเหตุ" minWidth={150} />
        {canEdit && (
          <DxColumn
            caption="การดำเนินการ"
            width={120}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
          />
        )}
      </DxDataGrid>

      {/* Record Test Dialog */}
      <DxPopup
        visible={!!testDialogSample}
        onHiding={() => setTestDialogSample(null)}
        title={`บันทึกผลทดสอบ - ${testDialogSample?.sampleNumber || ''}`}
        width={450}
        height="auto"
        showCloseButton
        // The body is gated by testDialogSample, the same state that opens this
        // popup, and DevExtreme caches the first (empty) deferred render — the
        // blank-popup bug T1064246 that hit /vmi/sync.
        deferRendering={false}
      >
        <div className="p-4 space-y-4">
          {testDialogSample && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>จุดเวลา:</div>
                <div className="font-semibold">{testDialogSample.timepoint}M</div>
                <div>กำหนดการ:</div>
                <div className="font-semibold">{testDialogSample.scheduledDate}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">รหัสการทดสอบคุณภาพ *</label>
            <DxNumberBox
              value={testData.qualityTestId}
              onValueChanged={(e) =>
                setTestData({ ...testData, qualityTestId: e.value || 0 })
              }
              min={1}
              placeholder="กรอกรหัสการทดสอบคุณภาพ..."
            />
            <p className="text-xs text-muted-foreground">
              อ้างอิงถึงระเบียนในตาราง quality_tests
            </p>
          </div>

          <div className="space-y-2">
            <DxCheckBox
              text="พบ OOS (ผลนอกข้อกำหนด)"
              value={testData.oosDetected}
              onValueChanged={(e) =>
                setTestData({ ...testData, oosDetected: e.value || false })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">หมายเหตุ</label>
            <DxTextArea
              value={testData.notes || ''}
              onValueChange={(value) => setTestData({ ...testData, notes: value || '' })}
              placeholder="เพิ่มหมายเหตุการทดสอบ..."
              height={80}
            />
          </div>

          {recordTestMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {recordTestMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              onClick={() => setTestDialogSample(null)}
              stylingMode="outlined"
            />
            <DxButton
              text="บันทึกผลทดสอบ"
              onClick={handleRecordTest}
              type="default"
              disabled={!testData.qualityTestId || recordTestMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </>
  );
}
