'use client';

// HR Employee Form - Reusable for Create/Edit
// Feature: 007-hr-personnel-management
// Enhanced with Thai CID, photo upload, and complete employee data fields

import { useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
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
  ChevronDown,
  ChevronRight,
  Save,
  X,
  UserPlus,
  Edit3,
  RefreshCw,
  Briefcase,
  Hash,
  CreditCard,
  MapPin,
  AlertCircle,
  GraduationCap,
  Shield,
  Stethoscope,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';
import type {
  EmployeeCreate,
  EmployeeProfile,
  EmployeeStatus,
  Gender,
  BloodType,
  MaritalStatus,
  EducationLevel,
  MilitaryStatus,
} from '@/types/hr';

// Select options
const GENDER_OPTIONS = [
  { value: 'male', label: 'ชาย' },
  { value: 'female', label: 'หญิง' },
  { value: 'other', label: 'อื่นๆ' },
];

const BLOOD_TYPE_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'โสด' },
  { value: 'married', label: 'สมรส' },
  { value: 'divorced', label: 'หย่าร้าง' },
  { value: 'widowed', label: 'หม้าย' },
];

const EDUCATION_LEVEL_OPTIONS = [
  { value: 'primary', label: 'ประถมศึกษา' },
  { value: 'secondary', label: 'มัธยมศึกษา' },
  { value: 'vocational', label: 'ปวช./ปวส.' },
  { value: 'bachelor', label: 'ปริญญาตรี' },
  { value: 'master', label: 'ปริญญาโท' },
  { value: 'doctorate', label: 'ปริญญาเอก' },
];

const MILITARY_STATUS_OPTIONS = [
  { value: 'exempted', label: 'ได้รับการยกเว้น' },
  { value: 'completed', label: 'ผ่านการเกณฑ์ทหารแล้ว' },
  { value: 'pending', label: 'รอเกณฑ์ทหาร' },
  { value: 'not_applicable', label: 'ไม่เกี่ยวข้อง' },
];

const RELIGION_OPTIONS = [
  { value: 'buddhism', label: 'พุทธ' },
  { value: 'islam', label: 'อิสลาม' },
  { value: 'christianity', label: 'คริสต์' },
  { value: 'hinduism', label: 'ฮินดู' },
  { value: 'other', label: 'อื่นๆ' },
];

export interface EmployeeFormData {
  // Basic
  employeeCode: string;
  firstName: string;
  lastName: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  email?: string;
  phone?: string;

  // Personal identification
  thaiCid?: string;
  dateOfBirth?: string;
  gender?: Gender;
  bloodType?: BloodType;
  religion?: string;
  maritalStatus?: MaritalStatus;
  nationalityCode?: string;

  // Photo
  photoUrl?: string;
  photoThumbnailUrl?: string;

  // Government IDs
  ssoNumber?: string;
  taxId?: string;

  // Current Address
  addressLine1?: string;
  addressLine2?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;

  // Permanent Address
  permanentAddressLine1?: string;
  permanentAddressLine2?: string;
  permanentSubDistrict?: string;
  permanentDistrict?: string;
  permanentProvince?: string;
  permanentPostalCode?: string;
  useSameAddress?: boolean;

  // Emergency Contact
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;

  // Banking
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;

  // Education
  educationLevel?: EducationLevel;
  educationField?: string;
  educationInstitution?: string;

  // Military
  militaryStatus?: MilitaryStatus;

  // Medical
  medicalNotes?: string;

  // Organization
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

// Collapsible Section Component
function FormSection({
  title,
  icon: Icon,
  iconColor,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </h3>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="p-6">{children}</div>}
    </div>
  );
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
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Compute initial form data from props
  const initialFormData = useMemo<EmployeeFormData>(() => ({
    employeeCode: initialData?.employeeCode || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    firstNameEn: initialData?.firstNameEn || '',
    lastNameEn: initialData?.lastNameEn || '',
    nickname: initialData?.nickname || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    thaiCid: initialData?.thaiCid || '',
    dateOfBirth: initialData?.dateOfBirth?.split('T')[0] || '',
    gender: initialData?.gender ?? undefined,
    bloodType: initialData?.bloodType ?? undefined,
    religion: initialData?.religion || '',
    maritalStatus: initialData?.maritalStatus ?? undefined,
    nationalityCode: initialData?.nationalityCode || 'TH',
    photoUrl: initialData?.photoUrl || '',
    photoThumbnailUrl: initialData?.photoThumbnailUrl || '',
    ssoNumber: initialData?.ssoNumber || '',
    taxId: initialData?.taxId || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    subDistrict: initialData?.subDistrict || '',
    district: initialData?.district || '',
    province: initialData?.province || '',
    postalCode: initialData?.postalCode || '',
    permanentAddressLine1: initialData?.permanentAddressLine1 || '',
    permanentAddressLine2: initialData?.permanentAddressLine2 || '',
    permanentSubDistrict: initialData?.permanentSubDistrict || '',
    permanentDistrict: initialData?.permanentDistrict || '',
    permanentProvince: initialData?.permanentProvince || '',
    permanentPostalCode: initialData?.permanentPostalCode || '',
    useSameAddress: initialData?.useSameAddress ?? false,
    emergencyContactName: initialData?.emergencyContactName || '',
    emergencyContactRelation: initialData?.emergencyContactRelation || '',
    emergencyContactPhone: initialData?.emergencyContactPhone || '',
    bankName: initialData?.bankName || '',
    bankBranch: initialData?.bankBranch || '',
    bankAccountNumber: initialData?.bankAccountNumber || '',
    bankAccountName: initialData?.bankAccountName || '',
    educationLevel: initialData?.educationLevel ?? undefined,
    educationField: initialData?.educationField || '',
    educationInstitution: initialData?.educationInstitution || '',
    militaryStatus: initialData?.militaryStatus ?? undefined,
    medicalNotes: initialData?.medicalNotes || '',
    positionId: initialData?.positionId || undefined,
    orgUnitId: initialData?.orgUnitId || undefined,
    hireDate: initialData?.hireDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: initialData?.status,
  }), [initialData]);

  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [userModifiedCode, setUserModifiedCode] = useState(mode === 'edit');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [thaiCidError, setThaiCidError] = useState<string | null>(null);

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

  // Photo upload handler
  const handlePhotoUpload = async (file: File) => {
    if (!employeeId && mode === 'edit') return;

    setIsUploadingPhoto(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('photo', file);

      const response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to upload photo');
      }

      const result = await response.json();
      setFormData(prev => ({
        ...prev,
        photoUrl: result.data.photoUrl,
        photoThumbnailUrl: result.data.photoThumbnailUrl,
      }));
      toast.success('สำเร็จ', 'อัปโหลดรูปภาพเรียบร้อย');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด', error instanceof Error ? error.message : 'ไม่สามารถอัปโหลดรูปภาพได้');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!employeeId) return;

    try {
      const response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete photo');
      }

      setFormData(prev => ({
        ...prev,
        photoUrl: '',
        photoThumbnailUrl: '',
      }));
      toast.success('สำเร็จ', 'ลบรูปภาพเรียบร้อย');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด', error instanceof Error ? error.message : 'ไม่สามารถลบรูปภาพได้');
    }
  };

  // Thai CID validation
  const validateThaiCid = (cid: string): boolean => {
    if (!cid) return true;

    const cleaned = cid.replace(/\D/g, '');
    if (cleaned.length !== 13) {
      setThaiCidError('เลขบัตรประชาชนต้องมี 13 หลัก');
      return false;
    }

    // Checksum validation
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned[i]) * (13 - i);
    }
    const checksum = (11 - (sum % 11)) % 10;
    if (checksum !== parseInt(cleaned[12])) {
      setThaiCidError('เลขบัตรประชาชนไม่ถูกต้อง');
      return false;
    }

    setThaiCidError(null);
    return true;
  };

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
    if (formData.thaiCid && !validateThaiCid(formData.thaiCid)) {
      toast.error('เลขบัตรประชาชนไม่ถูกต้อง');
      return;
    }

    const submitData: EmployeeCreate = {
      employeeCode: employeeCode,
      firstName: formData.firstName!,
      lastName: formData.lastName!,
      firstNameEn: formData.firstNameEn || undefined,
      lastNameEn: formData.lastNameEn || undefined,
      nickname: formData.nickname || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      thaiCid: formData.thaiCid || undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
      gender: formData.gender,
      bloodType: formData.bloodType,
      religion: formData.religion || undefined,
      maritalStatus: formData.maritalStatus,
      nationalityCode: formData.nationalityCode || 'TH',
      ssoNumber: formData.ssoNumber || undefined,
      taxId: formData.taxId || undefined,
      addressLine1: formData.addressLine1 || undefined,
      addressLine2: formData.addressLine2 || undefined,
      subDistrict: formData.subDistrict || undefined,
      district: formData.district || undefined,
      province: formData.province || undefined,
      postalCode: formData.postalCode || undefined,
      permanentAddressLine1: formData.useSameAddress ? formData.addressLine1 : formData.permanentAddressLine1 || undefined,
      permanentAddressLine2: formData.useSameAddress ? formData.addressLine2 : formData.permanentAddressLine2 || undefined,
      permanentSubDistrict: formData.useSameAddress ? formData.subDistrict : formData.permanentSubDistrict || undefined,
      permanentDistrict: formData.useSameAddress ? formData.district : formData.permanentDistrict || undefined,
      permanentProvince: formData.useSameAddress ? formData.province : formData.permanentProvince || undefined,
      permanentPostalCode: formData.useSameAddress ? formData.postalCode : formData.permanentPostalCode || undefined,
      useSameAddress: formData.useSameAddress,
      emergencyContactName: formData.emergencyContactName || undefined,
      emergencyContactRelation: formData.emergencyContactRelation || undefined,
      emergencyContactPhone: formData.emergencyContactPhone || undefined,
      bankName: formData.bankName || undefined,
      bankBranch: formData.bankBranch || undefined,
      bankAccountNumber: formData.bankAccountNumber || undefined,
      bankAccountName: formData.bankAccountName || undefined,
      educationLevel: formData.educationLevel,
      educationField: formData.educationField || undefined,
      educationInstitution: formData.educationInstitution || undefined,
      militaryStatus: formData.militaryStatus,
      medicalNotes: formData.medicalNotes || undefined,
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

  const handleInputChange = <K extends keyof EmployeeFormData>(
    field: K,
    value: EmployeeFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear Thai CID error when user types
    if (field === 'thaiCid') {
      setThaiCidError(null);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className={`hidden sm:flex w-12 h-12 rounded-xl items-center justify-center ${isCreate ? 'bg-blue-100' : 'bg-indigo-100'}`}>
                  {isCreate ? (
                    <UserPlus className="h-6 w-6 text-blue-600" />
                  ) : (
                    <Edit3 className="h-6 w-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
                    {isCreate ? 'เพิ่มพนักงานใหม่' : 'แก้ไขข้อมูลพนักงาน'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {isCreate ? 'กรอกข้อมูลพนักงานใหม่' : `รหัส: ${formData.employeeCode}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4" />
                ยกเลิก
              </button>
              <button
                type="submit"
                form="employee-form"
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">{isPending ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                <span className="sm:hidden">{isPending ? '...' : 'บันทึก'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <form id="employee-form" onSubmit={handleSubmit} className="px-4 lg:px-8 py-6 pb-24 sm:pb-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Row 1: Photo and Basic Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Photo Upload (Edit mode only) */}
            {mode === 'edit' && (
              <div className="lg:col-span-1">
                <FormSection title="รูปภาพ" icon={Camera} iconColor="text-pink-500" defaultOpen={true}>
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {formData.photoUrl ? (
                        <img
                          src={formData.photoUrl}
                          alt="Employee photo"
                          className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                          <User className="h-16 w-16 text-gray-400" />
                        </div>
                      )}
                      {isUploadingPhoto && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                        </div>
                      )}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                    />
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4" />
                        อัปโหลด
                      </button>
                      {formData.photoUrl && (
                        <button
                          type="button"
                          onClick={handlePhotoDelete}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          ลบ
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">JPEG, PNG, WebP (สูงสุด 5MB)</p>
                  </div>
                </FormSection>
              </div>
            )}

            {/* Basic Info */}
            <div className={mode === 'edit' ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <FormSection title="ข้อมูลพนักงาน" icon={User} iconColor="text-blue-500" defaultOpen={true}>
                <div className="space-y-5">
                  {/* Employee Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Hash className="h-4 w-4 inline mr-1.5 text-gray-400" />
                      รหัสพนักงาน <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
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
                          title="สร้างรหัสใหม่"
                        >
                          <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoadingCode ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Names Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ชื่อเล่น
                      </label>
                      <DxTextBox
                        value={formData.nickname || ''}
                        onValueChange={(value) => handleInputChange('nickname', value)}
                        placeholder="ชื่อเล่น"
                        width="100%"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name (English)
                      </label>
                      <DxTextBox
                        value={formData.firstNameEn || ''}
                        onValueChange={(value) => handleInputChange('firstNameEn', value)}
                        placeholder="First name"
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
                        placeholder="Last name"
                        width="100%"
                      />
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Mail className="h-4 w-4 inline mr-1.5 text-gray-400" />
                        อีเมล
                      </label>
                      <DxTextBox
                        mode="email"
                        value={formData.email || ''}
                        onValueChange={(value) => handleInputChange('email', value)}
                        placeholder="email@example.com"
                        width="100%"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Phone className="h-4 w-4 inline mr-1.5 text-gray-400" />
                        เบอร์โทร
                      </label>
                      <DxTextBox
                        mode="tel"
                        value={formData.phone || ''}
                        onValueChange={(value) => handleInputChange('phone', value)}
                        placeholder="0812345678"
                        width="100%"
                      />
                    </div>
                  </div>
                </div>
              </FormSection>
            </div>
          </div>

          {/* Personal Identification */}
          <FormSection title="ข้อมูลส่วนบุคคล" icon={CreditCard} iconColor="text-purple-500" defaultOpen={true}>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขบัตรประชาชน
                  </label>
                  <DxTextBox
                    value={formData.thaiCid || ''}
                    onValueChange={(value) => handleInputChange('thaiCid', value)}
                    placeholder="X-XXXX-XXXXX-XX-X"
                    width="100%"
                    maxLength={17}
                  />
                  {thaiCidError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {thaiCidError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    วันเกิด
                  </label>
                  <DxDateBox
                    value={formData.dateOfBirth || ''}
                    onValueChange={(value) => handleInputChange('dateOfBirth', value)}
                    width="100%"
                    showClearButton
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เพศ
                  </label>
                  <DxSelectBox
                    value={formData.gender || ''}
                    onValueChange={(value) => handleInputChange('gender', value as Gender)}
                    items={GENDER_OPTIONS}
                    placeholder="เลือกเพศ"
                    showClearButton
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    หมู่โลหิต
                  </label>
                  <DxSelectBox
                    value={formData.bloodType || ''}
                    onValueChange={(value) => handleInputChange('bloodType', value as BloodType)}
                    items={BLOOD_TYPE_OPTIONS}
                    placeholder="เลือกหมู่โลหิต"
                    showClearButton
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ศาสนา
                  </label>
                  <DxSelectBox
                    value={formData.religion || ''}
                    onValueChange={(value) => handleInputChange('religion', value)}
                    items={RELIGION_OPTIONS}
                    placeholder="เลือกศาสนา"
                    showClearButton
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    สถานภาพสมรส
                  </label>
                  <DxSelectBox
                    value={formData.maritalStatus || ''}
                    onValueChange={(value) => handleInputChange('maritalStatus', value as MaritalStatus)}
                    items={MARITAL_STATUS_OPTIONS}
                    placeholder="เลือกสถานภาพ"
                    showClearButton
                    width="100%"
                  />
                </div>
              </div>

              {/* Government IDs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขประกันสังคม
                  </label>
                  <DxTextBox
                    value={formData.ssoNumber || ''}
                    onValueChange={(value) => handleInputChange('ssoNumber', value)}
                    placeholder="เลขประกันสังคม"
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขประจำตัวผู้เสียภาษี
                  </label>
                  <DxTextBox
                    value={formData.taxId || ''}
                    onValueChange={(value) => handleInputChange('taxId', value)}
                    placeholder="เลขผู้เสียภาษี"
                    width="100%"
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Current Address */}
          <FormSection title="ที่อยู่ปัจจุบัน" icon={MapPin} iconColor="text-green-500" defaultOpen={false}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ที่อยู่บรรทัดที่ 1
                  </label>
                  <DxTextBox
                    value={formData.addressLine1 || ''}
                    onValueChange={(value) => handleInputChange('addressLine1', value)}
                    placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                    width="100%"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ที่อยู่บรรทัดที่ 2
                  </label>
                  <DxTextBox
                    value={formData.addressLine2 || ''}
                    onValueChange={(value) => handleInputChange('addressLine2', value)}
                    placeholder="ข้อมูลเพิ่มเติม"
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ตำบล/แขวง
                  </label>
                  <DxTextBox
                    value={formData.subDistrict || ''}
                    onValueChange={(value) => handleInputChange('subDistrict', value)}
                    placeholder="ตำบล/แขวง"
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    อำเภอ/เขต
                  </label>
                  <DxTextBox
                    value={formData.district || ''}
                    onValueChange={(value) => handleInputChange('district', value)}
                    placeholder="อำเภอ/เขต"
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    จังหวัด
                  </label>
                  <DxTextBox
                    value={formData.province || ''}
                    onValueChange={(value) => handleInputChange('province', value)}
                    placeholder="จังหวัด"
                    width="100%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    รหัสไปรษณีย์
                  </label>
                  <DxTextBox
                    value={formData.postalCode || ''}
                    onValueChange={(value) => handleInputChange('postalCode', value)}
                    placeholder="รหัสไปรษณีย์"
                    width="100%"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Permanent Address */}
          <FormSection title="ที่อยู่ตามทะเบียนบ้าน" icon={MapPin} iconColor="text-teal-500" defaultOpen={false}>
            <div className="space-y-4">
              <DxCheckBox
                text="ใช้ที่อยู่เดียวกับที่อยู่ปัจจุบัน"
                value={formData.useSameAddress}
                onValueChange={(value) => handleInputChange('useSameAddress', value)}
              />

              {!formData.useSameAddress && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ที่อยู่บรรทัดที่ 1
                    </label>
                    <DxTextBox
                      value={formData.permanentAddressLine1 || ''}
                      onValueChange={(value) => handleInputChange('permanentAddressLine1', value)}
                      placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                      width="100%"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ที่อยู่บรรทัดที่ 2
                    </label>
                    <DxTextBox
                      value={formData.permanentAddressLine2 || ''}
                      onValueChange={(value) => handleInputChange('permanentAddressLine2', value)}
                      placeholder="ข้อมูลเพิ่มเติม"
                      width="100%"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ตำบล/แขวง
                    </label>
                    <DxTextBox
                      value={formData.permanentSubDistrict || ''}
                      onValueChange={(value) => handleInputChange('permanentSubDistrict', value)}
                      placeholder="ตำบล/แขวง"
                      width="100%"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      อำเภอ/เขต
                    </label>
                    <DxTextBox
                      value={formData.permanentDistrict || ''}
                      onValueChange={(value) => handleInputChange('permanentDistrict', value)}
                      placeholder="อำเภอ/เขต"
                      width="100%"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      จังหวัด
                    </label>
                    <DxTextBox
                      value={formData.permanentProvince || ''}
                      onValueChange={(value) => handleInputChange('permanentProvince', value)}
                      placeholder="จังหวัด"
                      width="100%"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      รหัสไปรษณีย์
                    </label>
                    <DxTextBox
                      value={formData.permanentPostalCode || ''}
                      onValueChange={(value) => handleInputChange('permanentPostalCode', value)}
                      placeholder="รหัสไปรษณีย์"
                      width="100%"
                      maxLength={5}
                    />
                  </div>
                </div>
              )}
            </div>
          </FormSection>

          {/* Emergency Contact */}
          <FormSection title="ผู้ติดต่อฉุกเฉิน" icon={AlertCircle} iconColor="text-red-500" defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อผู้ติดต่อ
                </label>
                <DxTextBox
                  value={formData.emergencyContactName || ''}
                  onValueChange={(value) => handleInputChange('emergencyContactName', value)}
                  placeholder="ชื่อ-นามสกุล"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ความสัมพันธ์
                </label>
                <DxTextBox
                  value={formData.emergencyContactRelation || ''}
                  onValueChange={(value) => handleInputChange('emergencyContactRelation', value)}
                  placeholder="เช่น พ่อ แม่ คู่สมรส"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เบอร์โทร
                </label>
                <DxTextBox
                  mode="tel"
                  value={formData.emergencyContactPhone || ''}
                  onValueChange={(value) => handleInputChange('emergencyContactPhone', value)}
                  placeholder="0812345678"
                  width="100%"
                />
              </div>
            </div>
          </FormSection>

          {/* Banking Information */}
          <FormSection title="ข้อมูลธนาคาร" icon={CreditCard} iconColor="text-yellow-500" defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ธนาคาร
                </label>
                <DxTextBox
                  value={formData.bankName || ''}
                  onValueChange={(value) => handleInputChange('bankName', value)}
                  placeholder="ชื่อธนาคาร"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สาขา
                </label>
                <DxTextBox
                  value={formData.bankBranch || ''}
                  onValueChange={(value) => handleInputChange('bankBranch', value)}
                  placeholder="สาขา"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เลขที่บัญชี
                </label>
                <DxTextBox
                  value={formData.bankAccountNumber || ''}
                  onValueChange={(value) => handleInputChange('bankAccountNumber', value)}
                  placeholder="เลขที่บัญชี"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อบัญชี
                </label>
                <DxTextBox
                  value={formData.bankAccountName || ''}
                  onValueChange={(value) => handleInputChange('bankAccountName', value)}
                  placeholder="ชื่อบัญชี"
                  width="100%"
                />
              </div>
            </div>
          </FormSection>

          {/* Education */}
          <FormSection title="การศึกษา" icon={GraduationCap} iconColor="text-indigo-500" defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ระดับการศึกษา
                </label>
                <DxSelectBox
                  value={formData.educationLevel || ''}
                  onValueChange={(value) => handleInputChange('educationLevel', value as EducationLevel)}
                  items={EDUCATION_LEVEL_OPTIONS}
                  placeholder="เลือกระดับการศึกษา"
                  showClearButton
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สาขาวิชา
                </label>
                <DxTextBox
                  value={formData.educationField || ''}
                  onValueChange={(value) => handleInputChange('educationField', value)}
                  placeholder="สาขาวิชา"
                  width="100%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สถาบันการศึกษา
                </label>
                <DxTextBox
                  value={formData.educationInstitution || ''}
                  onValueChange={(value) => handleInputChange('educationInstitution', value)}
                  placeholder="ชื่อสถาบัน"
                  width="100%"
                />
              </div>
            </div>
          </FormSection>

          {/* Military Status */}
          <FormSection title="สถานะทางทหาร" icon={Shield} iconColor="text-gray-500" defaultOpen={false}>
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สถานะการเกณฑ์ทหาร
              </label>
              <DxSelectBox
                value={formData.militaryStatus || ''}
                onValueChange={(value) => handleInputChange('militaryStatus', value as MilitaryStatus)}
                items={MILITARY_STATUS_OPTIONS}
                placeholder="เลือกสถานะ"
                showClearButton
                width="100%"
              />
            </div>
          </FormSection>

          {/* Medical Notes */}
          <FormSection title="หมายเหตุทางการแพทย์" icon={Stethoscope} iconColor="text-rose-500" defaultOpen={false}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                บันทึกทางการแพทย์/อาการแพ้
              </label>
              <DxTextArea
                value={formData.medicalNotes || ''}
                onValueChange={(value) => handleInputChange('medicalNotes', value)}
                placeholder="ระบุข้อมูลทางการแพทย์ที่สำคัญ เช่น อาการแพ้ยา โรคประจำตัว"
                height={100}
                width="100%"
              />
            </div>
          </FormSection>

          {/* Organization & Position */}
          <FormSection title="หน่วยงานและตำแหน่ง" icon={Briefcase} iconColor="text-indigo-500" defaultOpen={true}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="h-4 w-4 inline mr-1.5 text-gray-400" />
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
                  <Briefcase className="h-4 w-4 inline mr-1.5 text-gray-400" />
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
          </FormSection>

          {/* Employment Info */}
          <FormSection title="ข้อมูลการจ้างงาน" icon={Calendar} iconColor="text-orange-500" defaultOpen={true}>
            <div className="max-w-sm">
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
          </FormSection>

        </div>
      </form>

      {/* Mobile Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:hidden z-20">
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
    </div>
  );
}
