'use client';

// HR Employee Form - Reusable for Create/Edit
// Feature: 007-hr-personnel-management

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import {
  OrgUnitPicker,
  PositionSelect,
} from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import {
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  Save,
  X,
  UserPlus,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import type { EmployeeCreate, EmployeeProfile, EmployeeStatus } from '@/types/hr';

export interface EmployeeFormData {
  employeeCode: string;
  firstName: string;
  lastName: string;
  firstNameEn?: string;
  lastNameEn?: string;
  email?: string;
  phone?: string;
  positionId?: number;
  orgUnitId?: number;
  hireDate: string;
  status?: EmployeeStatus;
}

export interface EmployeeFormProps {
  mode: 'create' | 'edit';
  employeeId?: string;
  initialData?: EmployeeProfile;
  onSuccess?: (id: number) => void;
  onCancel?: () => void;
}

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

async function updateEmployee(id: string, data: Partial<EmployeeCreate>): Promise<{ id: number }> {
  const response = await fetch(`/api/hr/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to update employee');
  }
  const result = await response.json();
  return result.data;
}

export function EmployeeForm({
  mode,
  employeeId,
  initialData,
  onSuccess,
  onCancel,
}: EmployeeFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Compute initial form data from props
  const initialFormData = useMemo<EmployeeFormData>(() => ({
    employeeCode: initialData?.employeeCode || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    firstNameEn: initialData?.firstNameEn || '',
    lastNameEn: initialData?.lastNameEn || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    positionId: initialData?.positionId || undefined,
    orgUnitId: initialData?.orgUnitId || undefined,
    hireDate: initialData?.hireDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: initialData?.status,
  }), [initialData]);

  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [userModifiedCode, setUserModifiedCode] = useState(mode === 'edit');

  // Fetch next employee code (only for create mode)
  const { data: nextCode, refetch: refetchNextCode, isLoading: isLoadingCode } = useQuery({
    queryKey: ['hr', 'employees', 'next-code'],
    queryFn: fetchNextCode,
    enabled: mode === 'create',
  });

  const displayCode = mode === 'edit'
    ? formData.employeeCode
    : (userModifiedCode ? formData.employeeCode : (nextCode || formData.employeeCode));

  const handleCodeChange = useCallback((value: string) => {
    setUserModifiedCode(true);
    setFormData(prev => ({ ...prev, employeeCode: value }));
  }, []);

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      toast.success('สำเร็จ', 'เพิ่มพนักงานใหม่เรียบร้อย');
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/hr/employees/${data.id}`);
      }
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<EmployeeCreate>) => updateEmployee(employeeId!, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', employeeId] });
      toast.success('สำเร็จ', 'แก้ไขข้อมูลพนักงานเรียบร้อย');
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/hr/employees/${employeeId}`);
      }
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const handleBack = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else if (mode === 'edit' && employeeId) {
      router.push(`/hr/employees/${employeeId}`);
    } else {
      router.push('/hr/employees');
    }
  }, [onCancel, mode, employeeId, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const employeeCode = displayCode || formData.employeeCode;

    // Validation
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

    const submitData = {
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
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  };

  const handleInputChange = (field: keyof EmployeeFormData, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">
                {isCreate ? 'เพิ่มพนักงานใหม่' : 'แก้ไขข้อมูลพนักงาน'}
              </h1>
              <p className="text-xs text-gray-500">
                {isCreate ? 'New Employee' : formData.employeeCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
              ยกเลิก
            </button>
            <button
              type="submit"
              form="employee-form"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <form id="employee-form" onSubmit={handleSubmit} className="p-4 pb-24 sm:pb-8 max-w-3xl mx-auto space-y-4">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-6 text-center">
            <div className="w-20 h-20 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3">
              {isCreate ? (
                <UserPlus className="h-10 w-10 text-white" />
              ) : (
                <Edit3 className="h-10 w-10 text-white" />
              )}
            </div>
            <h2 className="text-white font-semibold text-lg">
              {isCreate ? 'ข้อมูลพนักงานใหม่' : 'แก้ไขข้อมูลพนักงาน'}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              กรอกข้อมูลให้ครบถ้วน
            </p>
          </div>
        </div>

        {/* Employee Code Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              รหัสพนักงาน
            </h3>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รหัสพนักงาน <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={displayCode || ''}
                  onValueChange={handleCodeChange}
                  placeholder={isLoadingCode ? 'กำลังโหลด...' : 'เช่น EMP001'}
                  width="100%"
                  disabled={isLoadingCode || mode === 'edit'}
                  readOnly={mode === 'edit'}
                />
              </div>
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={() => {
                    refetchNextCode().then((result) => {
                      if (result.data) {
                        setUserModifiedCode(false);
                        setFormData(prev => ({ ...prev, employeeCode: result.data }));
                      }
                    });
                  }}
                  disabled={isLoadingCode}
                  className="flex-shrink-0 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoadingCode ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Info Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              ข้อมูลส่วนตัว
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Thai Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อ (ไทย) <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={formData.firstName || ''}
                  onValueChange={(value) => handleInputChange('firstName', value)}
                  placeholder="ชื่อภาษาไทย"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  นามสกุล (ไทย) <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={formData.lastName || ''}
                  onValueChange={(value) => handleInputChange('lastName', value)}
                  placeholder="นามสกุลภาษาไทย"
                  width="100%"
                />
              </div>
            </div>

            {/* English Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name (English)
                </label>
                <DxTextBox
                  value={formData.firstNameEn || ''}
                  onValueChange={(value) => handleInputChange('firstNameEn', value)}
                  placeholder="First name in English"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name (English)
                </label>
                <DxTextBox
                  value={formData.lastNameEn || ''}
                  onValueChange={(value) => handleInputChange('lastNameEn', value)}
                  placeholder="Last name in English"
                  width="100%"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-400" />
              ข้อมูลติดต่อ
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  อีเมล
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <DxTextBox
                    mode="email"
                    value={formData.email || ''}
                    onValueChange={(value) => handleInputChange('email', value)}
                    placeholder="email@example.com"
                    width="100%"
                    inputAttr={{ style: { paddingLeft: '2.5rem' } }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เบอร์โทร
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Phone className="h-4 w-4 text-gray-400" />
                  </div>
                  <DxTextBox
                    mode="tel"
                    value={formData.phone || ''}
                    onValueChange={(value) => handleInputChange('phone', value)}
                    placeholder="0812345678"
                    width="100%"
                    inputAttr={{ style: { paddingLeft: '2.5rem' } }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organization & Position Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              หน่วยงานและตำแหน่ง
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หน่วยงาน
                </label>
                <OrgUnitPicker
                  value={formData.orgUnitId || null}
                  onValueChange={(value) => handleInputChange('orgUnitId', value || undefined)}
                  placeholder="เลือกหน่วยงาน"
                  showClearButton
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ตำแหน่ง
                </label>
                <PositionSelect
                  value={formData.positionId || null}
                  onValueChange={(value) => handleInputChange('positionId', value || undefined)}
                  placeholder="เลือกตำแหน่ง"
                  showClearButton
                  orgUnitId={formData.orgUnitId}
                  width="100%"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Employment Info Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              ข้อมูลการจ้างงาน
            </h3>
          </div>
          <div className="p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                วันที่เริ่มงาน <span className="text-red-500">*</span>
              </label>
              <DxDateBox
                value={formData.hireDate || ''}
                onValueChange={(value) => handleInputChange('hireDate', value)}
                width="100%"
                showClearButton
              />
            </div>
          </div>
        </div>

        {/* Mobile Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:hidden">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="employee-form"
              disabled={isPending}
              className="flex-1 py-3 px-4 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
