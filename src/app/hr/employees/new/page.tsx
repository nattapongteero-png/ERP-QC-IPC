'use client';

// HR New Employee Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
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

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.employeeCode?.trim()) {
      newErrors.employeeCode = 'กรุณาระบุรหัสพนักงาน';
    }
    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'กรุณาระบุชื่อ';
    }
    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'กรุณาระบุนามสกุล';
    }
    if (!formData.hireDate) {
      newErrors.hireDate = 'กรุณาระบุวันที่เริ่มงาน';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
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
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสพนักงาน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.employeeCode || ''}
              onChange={(e) => handleInputChange('employeeCode', e.target.value)}
              placeholder="เช่น EMP001"
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.employeeCode ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.employeeCode && (
              <p className="text-red-500 text-sm mt-1">{errors.employeeCode}</p>
            )}
          </div>

          {/* Name (Thai) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ (ไทย) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName || ''}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="ชื่อภาษาไทย"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                นามสกุล (ไทย) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName || ''}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="นามสกุลภาษาไทย"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Name (English) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name (English)
              </label>
              <input
                type="text"
                value={formData.firstNameEn || ''}
                onChange={(e) => handleInputChange('firstNameEn', e.target.value)}
                placeholder="First name in English"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name (English)
              </label>
              <input
                type="text"
                value={formData.lastNameEn || ''}
                onChange={(e) => handleInputChange('lastNameEn', e.target.value)}
                placeholder="Last name in English"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@example.com"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เบอร์โทร
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="0812345678"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Hire Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              วันที่เริ่มงาน <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.hireDate || ''}
              onChange={(e) => handleInputChange('hireDate', e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.hireDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.hireDate && (
              <p className="text-red-500 text-sm mt-1">{errors.hireDate}</p>
            )}
          </div>
        </div>

        {/* Organization & Position */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            หน่วยงานและตำแหน่ง
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <OrgUnitPicker
                value={formData.orgUnitId || null}
                onValueChange={(value) => handleInputChange('orgUnitId', value || undefined)}
                label="หน่วยงาน"
                placeholder="เลือกหน่วยงาน"
                showClearButton
              />
            </div>
            <div>
              <PositionSelect
                value={formData.positionId || null}
                onValueChange={(value) => handleInputChange('positionId', value || undefined)}
                label="ตำแหน่ง"
                placeholder="เลือกตำแหน่ง"
                showClearButton
                orgUnitId={formData.orgUnitId}
              />
            </div>
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
