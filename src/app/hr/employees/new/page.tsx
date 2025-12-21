'use client';

// HR New Employee Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { OrgUnitPicker, PositionSelect } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { UserPlus } from 'lucide-react';
import type { EmployeeCreate } from '@/types/hr';

async function createEmployee(data: EmployeeCreate): Promise<{ id: number }> {
  const response = await fetch('/api/hr/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create employee');
  }
  const result = await response.json();
  return result.data;
}

export default function NewEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = useState<Partial<EmployeeCreate>>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    firstNameEn: '',
    lastNameEn: '',
    email: '',
    phone: '',
    hireDate: new Date().toISOString().split('T')[0],
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      toast.success('สำเร็จ', 'เพิ่มพนักงานใหม่เรียบร้อย');
      router.push(`/hr/employees/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const handleBack = useCallback(() => {
    router.push('/hr/employees');
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.employeeCode?.trim()) {
      toast.error('กรุณาระบุรหัสพนักงาน');
      return;
    }
    if (!formData.firstName?.trim()) {
      toast.error('กรุณาระบุชื่อ');
      return;
    }
    if (!formData.lastName?.trim()) {
      toast.error('กรุณาระบุนามสกุล');
      return;
    }
    if (!formData.hireDate) {
      toast.error('กรุณาระบุวันที่เริ่มงาน');
      return;
    }

    createMutation.mutate({
      employeeCode: formData.employeeCode!,
      firstName: formData.firstName!,
      lastName: formData.lastName!,
      firstNameEn: formData.firstNameEn || undefined,
      lastNameEn: formData.lastNameEn || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      positionId: formData.positionId || undefined,
      orgUnitId: formData.orgUnitId || undefined,
      hireDate: formData.hireDate!,
    });
  };

  const handleInputChange = (field: keyof EmployeeCreate, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <DxButton
          icon="back"
          type="default"
          stylingMode="text"
          onClick={handleBack}
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-blue-600" />
            เพิ่มพนักงานใหม่
          </h1>
          <p className="text-gray-500 mt-1">New Employee</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            ข้อมูลพื้นฐาน
          </h2>

          {/* Employee Code */}
          <DxTextBox
            label="รหัสพนักงาน"
            value={formData.employeeCode || ''}
            onValueChange={(value) => handleInputChange('employeeCode', value)}
            placeholder="เช่น EMP001"
            required
            requiredMessage="กรุณาระบุรหัสพนักงาน"
            width="100%"
          />

          {/* Name (Thai) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DxTextBox
              label="ชื่อ (ไทย)"
              value={formData.firstName || ''}
              onValueChange={(value) => handleInputChange('firstName', value)}
              placeholder="ชื่อภาษาไทย"
              required
              requiredMessage="กรุณาระบุชื่อ"
              width="100%"
            />
            <DxTextBox
              label="นามสกุล (ไทย)"
              value={formData.lastName || ''}
              onValueChange={(value) => handleInputChange('lastName', value)}
              placeholder="นามสกุลภาษาไทย"
              required
              requiredMessage="กรุณาระบุนามสกุล"
              width="100%"
            />
          </div>

          {/* Name (English) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DxTextBox
              label="First Name (English)"
              value={formData.firstNameEn || ''}
              onValueChange={(value) => handleInputChange('firstNameEn', value)}
              placeholder="First name in English"
              width="100%"
            />
            <DxTextBox
              label="Last Name (English)"
              value={formData.lastNameEn || ''}
              onValueChange={(value) => handleInputChange('lastNameEn', value)}
              placeholder="Last name in English"
              width="100%"
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DxTextBox
              label="อีเมล"
              mode="email"
              value={formData.email || ''}
              onValueChange={(value) => handleInputChange('email', value)}
              placeholder="email@example.com"
              width="100%"
            />
            <DxTextBox
              label="เบอร์โทร"
              mode="tel"
              value={formData.phone || ''}
              onValueChange={(value) => handleInputChange('phone', value)}
              placeholder="0812345678"
              width="100%"
            />
          </div>

          {/* Hire Date */}
          <DxDateBox
            label="วันที่เริ่มงาน"
            value={formData.hireDate || ''}
            onValueChange={(value) => handleInputChange('hireDate', value)}
            required
            requiredMessage="กรุณาระบุวันที่เริ่มงาน"
            width="100%"
            showClearButton
          />
        </div>

        {/* Organization & Position */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            หน่วยงานและตำแหน่ง
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OrgUnitPicker
              value={formData.orgUnitId || null}
              onValueChange={(value) => handleInputChange('orgUnitId', value || undefined)}
              label="หน่วยงาน"
              placeholder="เลือกหน่วยงาน"
              showClearButton
              width="100%"
            />
            <PositionSelect
              value={formData.positionId || null}
              onValueChange={(value) => handleInputChange('positionId', value || undefined)}
              label="ตำแหน่ง"
              placeholder="เลือกตำแหน่ง"
              showClearButton
              orgUnitId={formData.orgUnitId}
              width="100%"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <DxButton
            text="ยกเลิก"
            type="default"
            stylingMode="outlined"
            onClick={handleBack}
          />
          <DxButton
            text="บันทึก"
            type="success"
            stylingMode="contained"
            icon="save"
            useSubmitBehavior
            disabled={createMutation.isPending}
          />
        </div>
      </form>
    </div>
  );
}
