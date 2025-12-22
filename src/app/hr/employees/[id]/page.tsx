'use client';

// HR Employee Profile Page
// Feature: 007-hr-personnel-management

import { useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
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
  ChevronLeft,
  Edit3,
  MoreVertical,
  Clock,
  Shield,
  Award,
  CheckCircle2,
  XCircle,
  PauseCircle,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import type { EmployeeProfile, EmployeeStatus } from '@/types/hr';
import type { EmployeeAssignmentWithDetails } from '@/lib/services/hr.service';

const STATUS_CONFIG = {
  active: {
    label: 'ใช้งาน',
    icon: CheckCircle2,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  inactive: {
    label: 'พักงาน',
    icon: PauseCircle,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
  },
  terminated: {
    label: 'พ้นสภาพ',
    icon: XCircle,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
  },
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

// Generate gradient based on name
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-purple-500 to-pink-600',
    'from-orange-500 to-red-600',
    'from-cyan-500 to-blue-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-purple-600',
    'from-teal-500 to-emerald-600',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

// Calculate tenure
function calculateTenure(hireDate: string): string {
  const start = new Date(hireDate);
  const now = new Date();
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(((now.getTime() - start.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));

  if (years > 0) {
    return `${years} ปี ${months} เดือน`;
  }
  return `${months} เดือน`;
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const employeeId = params.id as string;

  const [showAssignments, setShowAssignments] = useState(false);
  const [showActions, setShowActions] = useState(false);

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
      setShowActions(false);
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

  const formatDate = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const thaiYear = date.getFullYear() + 543;
    return `${date.getDate()} ${date.toLocaleDateString('th-TH', { month: 'short' })} ${thaiYear}`;
  }, []);

  const avatarGradient = useMemo(() => {
    if (!profile) return 'from-gray-400 to-gray-500';
    return getAvatarGradient(`${profile.firstName}${profile.lastName}`);
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
          </div>
          {/* Profile skeleton */}
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl h-48"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">ไม่พบข้อมูลพนักงาน</h2>
          <p className="text-gray-500 text-sm mb-6">ข้อมูลพนักงานที่คุณค้นหาไม่มีในระบบ</p>
          <button
            onClick={handleBack}
            className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            กลับหน้ารายการ
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[profile.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const fullNameEn = profile.firstNameEn && profile.lastNameEn
    ? `${profile.firstNameEn} ${profile.lastNameEn}`
    : null;
  const initials = `${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">ข้อมูลพนักงาน</h1>
            <p className="text-xs text-gray-500">{profile.employeeCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEdit}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Edit3 className="h-5 w-5 text-gray-600" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreVertical className="h-5 w-5 text-gray-600" />
            </button>
            {/* Dropdown Actions */}
            {showActions && profile.status !== 'terminated' && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                  {profile.status === 'active' && (
                    <button
                      onClick={() => handleStatusChange('inactive')}
                      className="w-full px-4 py-2.5 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-3"
                      disabled={statusMutation.isPending}
                    >
                      <PauseCircle className="h-4 w-4" />
                      พักงาน
                    </button>
                  )}
                  {profile.status === 'inactive' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      className="w-full px-4 py-2.5 text-left text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-3"
                      disabled={statusMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      เปิดใช้งาน
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange('terminated')}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                    disabled={statusMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" />
                    พ้นสภาพ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 pb-8 space-y-4 max-w-3xl mx-auto">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Avatar & Name Section */}
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              {/* Avatar */}
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg flex-shrink-0`}>
                {initials}
              </div>

              {/* Name & Status */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{fullName}</h2>
                {fullNameEn && (
                  <p className="text-gray-500 text-sm mt-0.5">{fullNameEn}</p>
                )}

                {/* Status Badge */}
                <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor}`}>
                    <StatusIcon className="h-4 w-4" />
                    {statusConfig.label}
                  </span>
                  {profile.hireDate && (
                    <span className="text-xs text-gray-500 hidden sm:inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {calculateTenure(profile.hireDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Position */}
              {profile.position && (
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-xs font-medium">ตำแหน่ง</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                    {profile.position.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{profile.position.code}</p>
                </div>
              )}

              {/* Organization */}
              {profile.orgUnit && (
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <Building2 className="h-4 w-4" />
                    <span className="text-xs font-medium">หน่วยงาน</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                    {profile.orgUnit.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{profile.orgUnit.code}</p>
                </div>
              )}

              {/* Hire Date */}
              <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-medium">เริ่มงาน</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm sm:text-base">
                  {formatDate(profile.hireDate)}
                </p>
                {profile.hireDate && (
                  <p className="text-xs text-gray-500 sm:hidden">
                    {calculateTenure(profile.hireDate)}
                  </p>
                )}
              </div>

              {/* Tenure or Termination Date */}
              {profile.terminationDate ? (
                <div className="bg-red-50 rounded-xl p-3 sm:p-4 border border-red-100">
                  <div className="flex items-center gap-2 text-red-500 mb-1.5">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">พ้นสภาพ</span>
                  </div>
                  <p className="font-semibold text-red-700 text-sm sm:text-base">
                    {formatDate(profile.terminationDate)}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <Award className="h-4 w-4" />
                    <span className="text-xs font-medium">อายุงาน</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">
                    {profile.hireDate ? calculateTenure(profile.hireDate) : '-'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Info Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              ข้อมูลติดต่อ
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">อีเมล</p>
                  <p className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
                    {profile.email}
                  </p>
                </div>
              </a>
            )}

            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">เบอร์โทร</p>
                  <p className="font-medium text-gray-900 group-hover:text-emerald-600">
                    {profile.phone}
                  </p>
                </div>
              </a>
            )}

            {!profile.email && !profile.phone && (
              <div className="text-center py-6 text-gray-400">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ไม่มีข้อมูลติดต่อ</p>
              </div>
            )}
          </div>
        </div>

        {/* Authorizations Card */}
        {profile.authorizations && profile.authorizations.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                สิทธิ์การอนุมัติ
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {profile.authorizations.length} รายการ
                </span>
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {profile.authorizations.map((auth) => (
                <div
                  key={auth.id}
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-emerald-800 text-sm">
                      {auth.authType.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-xs text-emerald-600">
                      {formatDate(auth.effectiveFrom)}
                      {auth.effectiveTo && ` - ${formatDate(auth.effectiveTo)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignment History - Collapsible */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowAssignments(!showAssignments)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="h-5 w-5 text-gray-400" />
              ประวัติการดำรงตำแหน่ง
            </h3>
            <div className="flex items-center gap-2">
              {assignments.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {assignments.length}
                </span>
              )}
              {showAssignments ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>

          {showAssignments && (
            <div className="border-t border-gray-100 p-4">
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">ไม่มีประวัติการดำรงตำแหน่ง</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment, index) => (
                    <div
                      key={assignment.id}
                      className={`relative pl-6 ${index < assignments.length - 1 ? 'pb-3' : ''}`}
                    >
                      {/* Timeline line */}
                      {index < assignments.length - 1 && (
                        <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-gray-200" />
                      )}

                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 ${
                        assignment.isPrimary && !assignment.effectiveTo
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300'
                      }`} />

                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {assignment.positionTitle && (
                              <p className="font-semibold text-gray-900 text-sm sm:text-base">
                                {assignment.positionTitle}
                              </p>
                            )}
                            {assignment.orgUnitName && (
                              <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {assignment.orgUnitName}
                              </p>
                            )}
                          </div>
                          {assignment.isPrimary && !assignment.effectiveTo && (
                            <Badge variant="success" className="text-xs flex-shrink-0">
                              ปัจจุบัน
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            เริ่ม: {formatDate(assignment.effectiveFrom)}
                          </span>
                          {assignment.effectiveTo && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              สิ้นสุด: {formatDate(assignment.effectiveTo)}
                            </span>
                          )}
                        </div>

                        {assignment.reason && (
                          <p className="mt-2 text-xs text-gray-500 italic bg-white rounded-lg px-3 py-2">
                            {assignment.reason}
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

        {/* Desktop Action Buttons */}
        {profile.status !== 'terminated' && (
          <div className="hidden sm:flex bg-white rounded-2xl border border-gray-200 p-5 shadow-sm gap-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mr-auto">
              <Shield className="h-5 w-5 text-gray-400" />
              จัดการสถานะ
            </h3>
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
                icon="check"
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
        )}
      </div>
    </div>
  );
}
