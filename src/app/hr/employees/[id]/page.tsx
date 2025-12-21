'use client';

// HR Employee Profile Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  History,
  UserCheck,
} from 'lucide-react';
import type { EmployeeProfile, EmployeeStatus } from '@/types/hr';
import type { EmployeeAssignmentWithDetails } from '@/lib/services/hr.service';

const STATUS_CONFIG = {
  active: { label: 'ใช้งาน', variant: 'success' as const, bgColor: 'bg-green-100', textColor: 'text-green-700' },
  inactive: { label: 'พักงาน', variant: 'warning' as const, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  terminated: { label: 'พ้นสภาพ', variant: 'danger' as const, bgColor: 'bg-red-100', textColor: 'text-red-700' },
};

async function fetchEmployeeProfile(id: string): Promise<EmployeeProfile> {
  const response = await fetch(`/api/hr/employees/${id}`);
  if (!response.ok) throw new Error('Failed to fetch employee profile');
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch employee profile');
  return result.data;
}

async function fetchEmployeeAssignments(id: string): Promise<EmployeeAssignmentWithDetails[]> {
  const response = await fetch(`/api/hr/employees/${id}/assignments`);
  if (!response.ok) throw new Error('Failed to fetch assignments');
  const result = await response.json();
  return result.data || [];
}

async function updateEmployeeStatus(id: string, status: EmployeeStatus): Promise<void> {
  const response = await fetch(`/api/hr/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to update employee status');
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const employeeId = params.id as string;

  const [showAssignments, setShowAssignments] = useState(false);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['hr', 'employee', employeeId],
    queryFn: () => fetchEmployeeProfile(employeeId),
    enabled: !!employeeId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['hr', 'employee', employeeId, 'assignments'],
    queryFn: () => fetchEmployeeAssignments(employeeId),
    enabled: !!employeeId && showAssignments,
  });

  const statusMutation = useMutation({
    mutationFn: (status: EmployeeStatus) => updateEmployeeStatus(employeeId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      toast.success('สำเร็จ', 'อัปเดตสถานะพนักงานเรียบร้อย');
    },
    onError: () => {
      toast.error('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตสถานะพนักงานได้');
    },
  });

  const handleBack = useCallback(() => {
    router.push('/hr/employees');
  }, [router]);

  const handleEdit = useCallback(() => {
    router.push(`/hr/employees/${employeeId}/edit`);
  }, [router, employeeId]);

  const handleStatusChange = useCallback(
    (newStatus: EmployeeStatus) => {
      statusMutation.mutate(newStatus);
    },
    [statusMutation]
  );

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4 md:space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-6 text-center">
          <p className="text-red-600">ไม่พบข้อมูลพนักงาน</p>
          <DxButton
            text="กลับ"
            type="default"
            stylingMode="outlined"
            onClick={handleBack}
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[profile.status] || STATUS_CONFIG.active;
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const fullNameEn = profile.firstNameEn && profile.lastNameEn
    ? `${profile.firstNameEn} ${profile.lastNameEn}`
    : null;
  const initials = `${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}`;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title="ข้อมูลพนักงาน"
        subtitle={fullName}
        icon={User}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'พนักงาน', href: '/hr/employees' },
          { label: profile.employeeCode },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="back"
              type="default"
              stylingMode="text"
              onClick={handleBack}
              hint="กลับ"
            />
            <DxButton
              icon="edit"
              text="แก้ไข"
              type="default"
              stylingMode="outlined"
              onClick={handleEdit}
            />
          </div>
        }
      />

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header with gradient - Responsive */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 md:px-8 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="text-white text-center sm:text-left flex-1">
              <h2 className="text-lg md:text-xl font-semibold">{fullName}</h2>
              {fullNameEn && (
                <p className="text-blue-100 text-sm">{fullNameEn}</p>
              )}
              <p className="text-blue-100 text-sm mt-1">{profile.employeeCode}</p>
            </div>
            <div>
              <span className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left Column - Position & Organization */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                ตำแหน่งและหน่วยงาน
              </h3>

              <div className="space-y-4">
                {profile.position && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">ตำแหน่ง</p>
                      <p className="font-medium text-gray-900">{profile.position.title}</p>
                      {profile.position.titleEn && (
                        <p className="text-sm text-gray-500">{profile.position.titleEn}</p>
                      )}
                      <p className="text-xs text-gray-400">{profile.position.code}</p>
                    </div>
                  </div>
                )}

                {profile.orgUnit && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">หน่วยงาน</p>
                      <p className="font-medium text-gray-900">{profile.orgUnit.name}</p>
                      {profile.orgUnit.nameEn && (
                        <p className="text-sm text-gray-500">{profile.orgUnit.nameEn}</p>
                      )}
                      <p className="text-xs text-gray-400">{profile.orgUnit.code}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">วันที่เริ่มงาน</p>
                    <p className="font-medium text-gray-900">{formatDate(profile.hireDate)}</p>
                  </div>
                </div>

                {profile.terminationDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">วันที่พ้นสภาพ</p>
                      <p className="font-medium text-red-600">{formatDate(profile.terminationDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Contact Info */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                ข้อมูลติดต่อ
              </h3>

              <div className="space-y-4">
                {profile.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">อีเมล</p>
                      <a
                        href={`mailto:${profile.email}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {profile.email}
                      </a>
                    </div>
                  </div>
                )}

                {profile.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">เบอร์โทร</p>
                      <a
                        href={`tel:${profile.phone}`}
                        className="font-medium text-gray-900"
                      >
                        {profile.phone}
                      </a>
                    </div>
                  </div>
                )}

                {!profile.email && !profile.phone && (
                  <p className="text-gray-400 italic">ไม่มีข้อมูลติดต่อ</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Actions */}
      {profile.status !== 'terminated' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
            จัดการสถานะพนักงาน
          </h3>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3">
            {profile.status === 'active' && (
              <DxButton
                icon="pause"
                text="พักงาน"
                type="default"
                stylingMode="outlined"
                onClick={() => handleStatusChange('inactive')}
                disabled={statusMutation.isPending}
              />
            )}
            {profile.status === 'inactive' && (
              <DxButton
                icon="refresh"
                text="เปิดใช้งาน"
                type="success"
                stylingMode="contained"
                onClick={() => handleStatusChange('active')}
                disabled={statusMutation.isPending}
              />
            )}
            <DxButton
              icon="remove"
              text="พ้นสภาพ"
              type="danger"
              stylingMode="outlined"
              onClick={() => handleStatusChange('terminated')}
              disabled={statusMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Assignment History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowAssignments(!showAssignments)}
          className="w-full px-4 md:px-6 py-3 md:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors min-h-[44px]"
        >
          <div className="flex items-center gap-2 md:gap-3">
            <History className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
            <h3 className="text-base md:text-lg font-semibold text-gray-900">
              ประวัติการดำรงตำแหน่ง
            </h3>
          </div>
          <span className="text-gray-400 text-sm">
            {showAssignments ? '▲' : '▼'}
          </span>
        </button>

        {showAssignments && (
          <div className="border-t border-gray-200 p-4 md:p-6">
            {assignments.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm md:text-base">ไม่มีประวัติการดำรงตำแหน่ง</p>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {assignments.map((assignment, index) => (
                  <div
                    key={assignment.id}
                    className={`relative pl-6 md:pl-8 pb-3 md:pb-4 ${
                      index < assignments.length - 1 ? 'border-l-2 border-gray-200' : ''
                    }`}
                  >
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-0 w-3 h-3 md:w-4 md:h-4 rounded-full -translate-x-1/2 ${
                      assignment.isPrimary && !assignment.effectiveTo
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                    }`} />

                    <div className="bg-gray-50 rounded-lg p-3 md:p-4 ml-1 md:ml-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          {assignment.positionTitle && (
                            <p className="font-medium text-gray-900 text-sm md:text-base">
                              {assignment.positionTitle}
                            </p>
                          )}
                          {assignment.orgUnitName && (
                            <p className="text-xs md:text-sm text-gray-600">
                              {assignment.orgUnitName}
                            </p>
                          )}
                        </div>
                        {assignment.isPrimary && !assignment.effectiveTo && (
                          <Badge variant="success" className="text-xs self-start">
                            ปัจจุบัน
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500">
                        <span>
                          เริ่ม: {formatDate(assignment.effectiveFrom)}
                        </span>
                        {assignment.effectiveTo && (
                          <span>
                            สิ้นสุด: {formatDate(assignment.effectiveTo)}
                          </span>
                        )}
                      </div>
                      {assignment.reason && (
                        <p className="mt-2 text-xs md:text-sm text-gray-600 italic">
                          หมายเหตุ: {assignment.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Authorizations */}
      {profile.authorizations && profile.authorizations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <UserCheck className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
            <h3 className="text-base md:text-lg font-semibold text-gray-900">
              สิทธิ์การอนุมัติ
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {profile.authorizations.map((auth) => (
              <div
                key={auth.id}
                className="bg-green-50 border border-green-200 rounded-lg p-3 md:p-4"
              >
                <p className="font-medium text-green-800 text-sm md:text-base">
                  {auth.authType.replace(/_/g, ' ').toUpperCase()}
                </p>
                <p className="text-xs md:text-sm text-green-600 mt-1">
                  มีผล: {formatDate(auth.effectiveFrom)}
                  {auth.effectiveTo && ` - ${formatDate(auth.effectiveTo)}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
