'use client';

// HR Health Record Form Component
// Feature: 007-hr-personnel-management
// Pattern: Aligned with Template module form design

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { AuditLogViewerDialog } from '@/components/shared/AuditLogViewerDialog';
import Form, { Item, Label, RequiredRule, FormRef } from 'devextreme-react/form';
import SelectBox from 'devextreme-react/select-box';
import TextArea from 'devextreme-react/text-area';
import TagBox from 'devextreme-react/tag-box';
import TextBox from 'devextreme-react/text-box';
import LoadIndicator from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import type {
  HealthRecord,
  HealthRecordCreate,
  ExaminationType,
  FitnessStatus,
  EmployeeSummary,
} from '@/types/hr';

export interface HealthRecordFormProps {
  mode: 'create' | 'edit';
  recordId?: number;
  onSuccess?: (record: HealthRecord) => void;
  onCancel?: () => void;
}

interface FormData {
  employeeId: number | undefined;
  examinationType: ExaminationType | undefined;
  examinationDate: string;
  nextExamDue: string;
  fitnessStatus: FitnessStatus | undefined;
  restrictions: string;
  affectedAreas: string[];
  medicalDetails: string;
  examinerName: string;
  examinerNotes: string;
}

const EXAMINATION_TYPE_OPTIONS = [
  { value: 'pre_employment', label: 'ก่อนเข้างาน (Pre-employment)' },
  { value: 'periodic', label: 'ตรวจประจำปี (Periodic)' },
  { value: 'special', label: 'ตรวจพิเศษ (Special)' },
];

const FITNESS_STATUS_OPTIONS = [
  { value: 'fit', label: 'พร้อมปฏิบัติงาน (Fit)', variant: 'success' },
  { value: 'unfit', label: 'ไม่พร้อมปฏิบัติงาน (Unfit)', variant: 'danger' },
  { value: 'restricted', label: 'มีข้อจำกัด (Restricted)', variant: 'warning' },
];

const AFFECTED_AREAS_OPTIONS = [
  'ฝ่ายผลิต',
  'ฝ่ายควบคุมคุณภาพ',
  'ฝ่ายบรรจุ',
  'ฝ่ายคลังสินค้า',
  'ทุกฝ่าย',
];

const defaultFormData: FormData = {
  employeeId: undefined,
  examinationType: undefined,
  examinationDate: new Date().toISOString().split('T')[0],
  nextExamDue: '',
  fitnessStatus: undefined,
  restrictions: '',
  affectedAreas: [],
  medicalDetails: '',
  examinerName: '',
  examinerNotes: '',
};

async function fetchEmployees(): Promise<EmployeeSummary[]> {
  const res = await fetch('/api/hr/employees?status=active');
  if (!res.ok) throw new Error('Failed to fetch employees');
  const data = await res.json();
  return data.data || [];
}

async function fetchRecord(id: number): Promise<HealthRecord> {
  const res = await fetch(`/api/hr/health-records/${id}`);
  if (!res.ok) throw new Error('Failed to fetch health record');
  const data = await res.json();
  return data.data;
}

async function createRecord(data: HealthRecordCreate): Promise<HealthRecord> {
  const res = await fetch('/api/hr/health-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const errorMessages = errorData.errors
        .map((e: { field: string; message: string }) => `${e.field}: ${e.message}`)
        .join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw new Error(errorData.error || errorData.message || 'Failed to create record');
  }
  const result = await res.json();
  return result.data;
}

async function updateRecord(id: number, data: Partial<HealthRecordCreate>): Promise<HealthRecord> {
  const res = await fetch(`/api/hr/health-records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const errorMessages = errorData.errors
        .map((e: { field: string; message: string }) => `${e.field}: ${e.message}`)
        .join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw new Error(errorData.error || errorData.message || 'Failed to update record');
  }
  const result = await res.json();
  return result.data;
}

async function deleteRecord(id: number): Promise<void> {
  const res = await fetch(`/api/hr/health-records/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || error.message || 'Failed to delete record');
  }
}

export function HealthRecordForm({
  mode,
  recordId,
  onSuccess,
  onCancel,
}: HealthRecordFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = React.useRef<FormRef>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
  });

  // Fetch record for edit mode
  const { data: existingRecord, isLoading: isLoadingRecord } = useQuery({
    queryKey: ['hr', 'health-record', recordId],
    queryFn: () => fetchRecord(recordId!),
    enabled: mode === 'edit' && !!recordId,
  });

  // Set form data when record is loaded
  React.useEffect(() => {
    if (existingRecord) {
      const affectedAreas = existingRecord.affectedAreas
        ? (typeof existingRecord.affectedAreas === 'string'
            ? JSON.parse(existingRecord.affectedAreas)
            : existingRecord.affectedAreas)
        : [];

      setFormData({
        employeeId: existingRecord.employeeId,
        examinationType: existingRecord.examinationType,
        examinationDate: existingRecord.examinationDate?.split('T')[0] || '',
        nextExamDue: existingRecord.nextExamDue?.split('T')[0] || '',
        fitnessStatus: existingRecord.fitnessStatus,
        restrictions: existingRecord.restrictions || '',
        affectedAreas: affectedAreas,
        medicalDetails: (existingRecord as HealthRecord).medicalDetails || '',
        examinerName: existingRecord.examinerName || '',
        examinerNotes: (existingRecord as HealthRecord).examinerNotes || '',
      });
    }
  }, [existingRecord]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createRecord,
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-records'] });
      notify('บันทึกผลตรวจสุขภาพสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(record);
      } else {
        router.push('/hr/health-records');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<HealthRecordCreate>) => updateRecord(recordId!, data),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-records'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-record', recordId] });
      notify('อัปเดตผลตรวจสุขภาพสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(record);
      } else {
        router.push('/hr/health-records');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteRecord(recordId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'health-records'] });
      notify('ลบบันทึกสุขภาพสำเร็จ', 'success', 3000);
      router.push('/hr/health-records');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    const validationResult = formRef.current?.instance()?.validate();
    if (!validationResult?.isValid) {
      notify('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'warning', 3000);
      return;
    }

    if (!formData.employeeId || !formData.examinationType || !formData.fitnessStatus) {
      notify('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'warning', 3000);
      return;
    }

    if (mode === 'create') {
      const createData: HealthRecordCreate = {
        employeeId: formData.employeeId,
        examinationType: formData.examinationType,
        examinationDate: formData.examinationDate,
        nextExamDue: formData.nextExamDue || undefined,
        fitnessStatus: formData.fitnessStatus,
        restrictions: formData.restrictions || undefined,
        affectedAreas: formData.affectedAreas.length > 0 ? formData.affectedAreas : undefined,
        medicalDetails: formData.medicalDetails || undefined,
        examinerName: formData.examinerName || undefined,
        examinerNotes: formData.examinerNotes || undefined,
      };
      createMutation.mutate(createData);
    } else {
      const updateData: Partial<HealthRecordCreate> = {
        examinationType: formData.examinationType,
        examinationDate: formData.examinationDate,
        nextExamDue: formData.nextExamDue || undefined,
        fitnessStatus: formData.fitnessStatus,
        restrictions: formData.restrictions || undefined,
        affectedAreas: formData.affectedAreas.length > 0 ? formData.affectedAreas : undefined,
        medicalDetails: formData.medicalDetails || undefined,
        examinerName: formData.examinerName || undefined,
        examinerNotes: formData.examinerNotes || undefined,
      };
      updateMutation.mutate(updateData);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  // Get employee name for display
  const selectedEmployee = employees.find((e) => e.id === formData.employeeId);
  const employeeName = selectedEmployee?.fullName || '';

  if (mode === 'edit' && isLoadingRecord) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            text="กลับ"
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'บันทึกผลตรวจสุขภาพใหม่' : `แก้ไข: ${employeeName}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <Button
              text="ลบ"
              icon={isDeleting ? 'spindown' : 'trash'}
              type="danger"
              stylingMode="outlined"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            />
          )}
          <Button
            text="ยกเลิก"
            icon="close"
            stylingMode="outlined"
            onClick={handleCancel}
            disabled={isSubmitting}
          />
          <Button
            text={mode === 'create' ? 'บันทึก' : 'บันทึกการเปลี่ยนแปลง'}
            icon={isSubmitting ? 'spindown' : 'save'}
            type="success"
            onClick={handleSubmit}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">ยืนยันการลบ</p>
                <p className="text-sm text-red-600">
                  คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกสุขภาพนี้? การดำเนินการนี้ไม่สามารถยกเลิกได้
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="ยกเลิก"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text="ลบ"
                  icon="trash"
                  type="danger"
                  onClick={handleDelete}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลการตรวจสุขภาพ</CardTitle>
            </CardHeader>
            <CardContent>
              <Form
                ref={formRef}
                formData={formData}
                onFieldDataChanged={(e) => {
                  if (e.dataField) {
                    setFormData((prev) => ({ ...prev, [e.dataField!]: e.value }));
                  }
                }}
                labelLocation="top"
                showColonAfterLabel={false}
                colCount={2}
              >
                <Item colSpan={1}>
                  <Label text="พนักงาน" />
                  <SelectBox
                    dataSource={employees}
                    displayExpr="fullName"
                    valueExpr="id"
                    value={formData.employeeId}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, employeeId: e.value }))}
                    searchEnabled
                    placeholder="เลือกพนักงาน..."
                    disabled={mode === 'edit'}
                  />
                  <RequiredRule message="กรุณาเลือกพนักงาน" />
                </Item>
                <Item colSpan={1}>
                  <Label text="ประเภทการตรวจ" />
                  <SelectBox
                    dataSource={EXAMINATION_TYPE_OPTIONS}
                    displayExpr="label"
                    valueExpr="value"
                    value={formData.examinationType}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, examinationType: e.value }))}
                    placeholder="เลือกประเภท..."
                  />
                  <RequiredRule message="กรุณาเลือกประเภทการตรวจ" />
                </Item>
              </Form>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <DxDateBox
                  label="วันที่ตรวจ"
                  value={formData.examinationDate}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, examinationDate: value }))
                  }
                  required
                  requiredMessage="กรุณาระบุวันที่ตรวจ"
                />
                <DxDateBox
                  label="ครบกำหนดตรวจครั้งถัดไป"
                  value={formData.nextExamDue}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, nextExamDue: value || '' }))
                  }
                  showClearButton
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ผลการตรวจ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สถานะความพร้อม <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  dataSource={FITNESS_STATUS_OPTIONS}
                  displayExpr="label"
                  valueExpr="value"
                  value={formData.fitnessStatus}
                  onValueChanged={(e) => setFormData((prev) => ({ ...prev, fitnessStatus: e.value }))}
                  placeholder="เลือกสถานะ..."
                />
              </div>

              {formData.fitnessStatus === 'restricted' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ข้อจำกัดการปฏิบัติงาน
                    </label>
                    <TextArea
                      value={formData.restrictions}
                      onValueChanged={(e) =>
                        setFormData((prev) => ({ ...prev, restrictions: e.value || '' }))
                      }
                      placeholder="ระบุข้อจำกัด..."
                      height={80}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      พื้นที่ที่ได้รับผลกระทบ
                    </label>
                    <TagBox
                      items={AFFECTED_AREAS_OPTIONS}
                      value={formData.affectedAreas}
                      onValueChanged={(e) =>
                        setFormData((prev) => ({ ...prev, affectedAreas: e.value || [] }))
                      }
                      showSelectionControls
                      placeholder="เลือกพื้นที่..."
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อผู้ตรวจ
                </label>
                <TextBox
                  value={formData.examinerName}
                  onValueChanged={(e) =>
                    setFormData((prev) => ({ ...prev, examinerName: e.value || '' }))
                  }
                  placeholder="ระบุชื่อแพทย์/พยาบาล..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">รายละเอียดทางการแพทย์ (เฉพาะเจ้าหน้าที่สุขภาพ)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รายละเอียดทางการแพทย์
                </label>
                <TextArea
                  value={formData.medicalDetails}
                  onValueChanged={(e) =>
                    setFormData((prev) => ({ ...prev, medicalDetails: e.value || '' }))
                  }
                  placeholder="ระบุรายละเอียด..."
                  height={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมายเหตุผู้ตรวจ
                </label>
                <TextArea
                  value={formData.examinerNotes}
                  onValueChanged={(e) =>
                    setFormData((prev) => ({ ...prev, examinerNotes: e.value || '' }))
                  }
                  placeholder="ระบุหมายเหตุ..."
                  height={80}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สถานะ</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.fitnessStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">สถานะปัจจุบัน:</span>
                  <Badge
                    variant={
                      formData.fitnessStatus === 'fit'
                        ? 'success'
                        : formData.fitnessStatus === 'unfit'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {FITNESS_STATUS_OPTIONS.find((s) => s.value === formData.fitnessStatus)?.label}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {mode === 'edit' && existingRecord && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลบันทึก</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono text-gray-900">{existingRecord.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">พนักงาน</span>
                  <span className="text-gray-900">{employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">บันทึกเมื่อ</span>
                  <span className="text-gray-900">
                    {new Date(existingRecord.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">อัปเดตล่าสุด</span>
                  <span className="text-gray-900">
                    {new Date(existingRecord.updatedAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <Button
                    text="ประวัติการเปลี่ยนแปลง"
                    icon="clock"
                    stylingMode="outlined"
                    type="default"
                    width="100%"
                    onClick={() => setShowAuditLog(true)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Audit Log Dialog */}
      {mode === 'edit' && recordId && (
        <AuditLogViewerDialog
          entityType="hrHealthRecords"
          entityId={recordId}
          visible={showAuditLog}
          onClose={() => setShowAuditLog(false)}
          title={`ประวัติการเปลี่ยนแปลง: ${employeeName}`}
          fieldLabels={{
            examinationType: 'ประเภทการตรวจ',
            examinationDate: 'วันที่ตรวจ',
            nextExamDue: 'ครบกำหนดถัดไป',
            fitnessStatus: 'สถานะความพร้อม',
            restrictions: 'ข้อจำกัด',
            affectedAreas: 'พื้นที่ได้รับผลกระทบ',
            medicalDetails: 'รายละเอียดทางการแพทย์',
            examinerName: 'ผู้ตรวจ',
            examinerNotes: 'หมายเหตุผู้ตรวจ',
          }}
        />
      )}
    </div>
  );
}
