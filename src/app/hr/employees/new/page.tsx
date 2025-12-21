'use client';

// HR New Employee Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import {
  OrgUnitPicker,
  PositionSelect,
  ResponsivePageHeader,
  FormSection,
  FormField,
} from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import { UserPlus } from 'lucide-react';
import type { EmployeeCreate } from '@/types/hr';

// Fetch next available employee code
async function fetchNextCode(): Promise<string> {
  const response = await fetch('/api/hr/employees/next-code');
  if (!response.ok) {
    throw new Error('Failed to fetch next code');
  }
  const result = await response.json();
  return result.data?.code || 'EMP001';
}

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

  // Track if user has manually changed the code
  const [userModifiedCode, setUserModifiedCode] = useState(false);

  // Fetch next employee code
  const { data: nextCode, refetch: refetchNextCode, isLoading: isLoadingCode } = useQuery({
    queryKey: ['hr', 'employees', 'next-code'],
    queryFn: fetchNextCode,
  });

  // Get the display code: use formData if user modified it, otherwise use nextCode
  const displayCode = userModifiedCode ? formData.employeeCode : (nextCode || formData.employeeCode);

  // Handler for code change that tracks user modification
  const handleCodeChange = useCallback((value: string) => {
    setUserModifiedCode(true);
    setFormData(prev => ({ ...prev, employeeCode: value }));
  }, []);

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

    // Use displayCode for the actual employee code
    const employeeCode = displayCode || formData.employeeCode;

    // Basic validation
    if (!employeeCode?.trim()) {
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
      employeeCode: employeeCode,
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl mx-auto">
      {/* T018: ResponsivePageHeader */}
      <ResponsivePageHeader
        title="เพิ่มพนักงานใหม่"
        subtitle="New Employee"
        icon={UserPlus}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        onBack={handleBack}
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'พนักงาน', href: '/hr/employees' },
          { label: 'เพิ่มใหม่' },
        ]}
      />

      {/* Form - T019: Responsive grid layout */}
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* Basic Info Section */}
        <FormSection title="ข้อมูลพื้นฐาน" columns={2}>
          {/* Employee Code - Full width with refresh button */}
          <FormField label="รหัสพนักงาน" required colSpan="full">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <DxTextBox
                  value={displayCode || ''}
                  onValueChange={handleCodeChange}
                  placeholder={isLoadingCode ? 'กำลังโหลด...' : 'เช่น EMP001'}
                  width="100%"
                  disabled={isLoadingCode}
                />
              </div>
              <DxButton
                icon="refresh"
                type="default"
                stylingMode="outlined"
                hint="สร้างรหัสใหม่"
                onClick={() => {
                  refetchNextCode().then((result) => {
                    if (result.data) {
                      setUserModifiedCode(false);
                      setFormData(prev => ({ ...prev, employeeCode: result.data }));
                    }
                  });
                }}
                disabled={isLoadingCode}
              />
            </div>
          </FormField>

          {/* Name (Thai) */}
          <FormField label="ชื่อ (ไทย)" required>
            <DxTextBox
              value={formData.firstName || ''}
              onValueChange={(value) => handleInputChange('firstName', value)}
              placeholder="ชื่อภาษาไทย"
              width="100%"
            />
          </FormField>
          <FormField label="นามสกุล (ไทย)" required>
            <DxTextBox
              value={formData.lastName || ''}
              onValueChange={(value) => handleInputChange('lastName', value)}
              placeholder="นามสกุลภาษาไทย"
              width="100%"
            />
          </FormField>

          {/* Name (English) */}
          <FormField label="First Name (English)">
            <DxTextBox
              value={formData.firstNameEn || ''}
              onValueChange={(value) => handleInputChange('firstNameEn', value)}
              placeholder="First name in English"
              width="100%"
            />
          </FormField>
          <FormField label="Last Name (English)">
            <DxTextBox
              value={formData.lastNameEn || ''}
              onValueChange={(value) => handleInputChange('lastNameEn', value)}
              placeholder="Last name in English"
              width="100%"
            />
          </FormField>

          {/* Contact */}
          <FormField label="อีเมล">
            <DxTextBox
              mode="email"
              value={formData.email || ''}
              onValueChange={(value) => handleInputChange('email', value)}
              placeholder="email@example.com"
              width="100%"
            />
          </FormField>
          <FormField label="เบอร์โทร">
            <DxTextBox
              mode="tel"
              value={formData.phone || ''}
              onValueChange={(value) => handleInputChange('phone', value)}
              placeholder="0812345678"
              width="100%"
            />
          </FormField>

          {/* Hire Date */}
          <FormField label="วันที่เริ่มงาน" required colSpan="full">
            <DxDateBox
              value={formData.hireDate || ''}
              onValueChange={(value) => handleInputChange('hireDate', value)}
              width="100%"
              showClearButton
            />
          </FormField>
        </FormSection>

        {/* Organization & Position Section */}
        <FormSection title="หน่วยงานและตำแหน่ง" columns={2}>
          <FormField label="หน่วยงาน">
            <OrgUnitPicker
              value={formData.orgUnitId || null}
              onValueChange={(value) => handleInputChange('orgUnitId', value || undefined)}
              placeholder="เลือกหน่วยงาน"
              showClearButton
              width="100%"
            />
          </FormField>
          <FormField label="ตำแหน่ง">
            <PositionSelect
              value={formData.positionId || null}
              onValueChange={(value) => handleInputChange('positionId', value || undefined)}
              placeholder="เลือกตำแหน่ง"
              showClearButton
              orgUnitId={formData.orgUnitId}
              width="100%"
            />
          </FormField>
        </FormSection>

        {/* T020: Action buttons - stack on mobile */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <DxButton
            text="ยกเลิก"
            type="default"
            stylingMode="outlined"
            onClick={handleBack}
            width="100%"
            className="sm:w-auto"
          />
          <DxButton
            text="บันทึก"
            type="success"
            stylingMode="contained"
            icon="save"
            useSubmitBehavior
            disabled={createMutation.isPending}
            width="100%"
            className="sm:w-auto"
          />
        </div>
      </form>
    </div>
  );
}
