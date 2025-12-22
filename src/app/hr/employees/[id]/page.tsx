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
  Hash,
  Globe,
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
  },
  inactive: {
    label: 'พักงาน',
    icon: PauseCircle,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  terminated: {
    label: 'พ้นสภาพ',
    icon: XCircle,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
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

  const [showAssignments, setShowAssignments] = useState(true);
  const [showActions, setShowActions] = useState(false);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['hr', 'employee', employeeId],
    queryFn: () => fetchEmployeeProfile(employeeId),
    enabled: !!employeeId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['hr', 'employee', employeeId, 'assignments'],
    queryFn: () => fetchEmployeeAssignments(employeeId),
    enabled: !!employeeId,
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
          <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4">
            <div className="max-w-6xl mx-auto flex items-center gap-4">
              <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          </div>
          <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl h-64"></div>
                <div className="bg-white rounded-xl h-48"></div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl h-48"></div>
                <div className="bg-white rounded-xl h-32"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-sm w-full shadow-sm">
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
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className={`hidden sm:flex w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient} items-center justify-center text-white font-bold text-lg shadow-md`}>
                  {initials}
                </div>
                <div>
                  <h1 className="text-lg lg:text-xl font-semibold text-gray-900">{fullName}</h1>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{profile.employeeCode}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEdit}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                แก้ไข
              </button>
              <button
                onClick={handleEdit}
                className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit3 className="h-5 w-5 text-gray-600" />
              </button>
              <div className="relative sm:hidden">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical className="h-5 w-5 text-gray-600" />
                </button>
                {showActions && profile.status !== 'terminated' && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
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
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-500" />
                    ข้อมูลพนักงาน
                  </h3>
                </div>
                <div className="p-6">
                  {/* Avatar & Name - Desktop */}
                  <div className="flex items-start gap-5 mb-6">
                    <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-2xl lg:text-3xl font-bold shadow-lg flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl lg:text-2xl font-bold text-gray-900">{fullName}</h2>
                      {fullNameEn && (
                        <p className="text-gray-500 flex items-center gap-1.5 mt-1">
                          <Globe className="h-4 w-4" />
                          {fullNameEn}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor}`}>
                          <StatusIcon className="h-4 w-4" />
                          {statusConfig.label}
                        </span>
                        {profile.hireDate && (
                          <span className="text-sm text-gray-500 flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            อายุงาน {calculateTenure(profile.hireDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Hash className="h-4 w-4" />
                        <span className="text-xs font-medium">รหัสพนักงาน</span>
                      </div>
                      <p className="font-semibold text-gray-900">{profile.employeeCode}</p>
                    </div>

                    {profile.position && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                          <Briefcase className="h-4 w-4" />
                          <span className="text-xs font-medium">ตำแหน่ง</span>
                        </div>
                        <p className="font-semibold text-gray-900 truncate">{profile.position.title}</p>
                        <p className="text-xs text-gray-500 truncate">{profile.position.code}</p>
                      </div>
                    )}

                    {profile.orgUnit && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                          <Building2 className="h-4 w-4" />
                          <span className="text-xs font-medium">หน่วยงาน</span>
                        </div>
                        <p className="font-semibold text-gray-900 truncate">{profile.orgUnit.name}</p>
                        <p className="text-xs text-gray-500 truncate">{profile.orgUnit.code}</p>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs font-medium">เริ่มงาน</span>
                      </div>
                      <p className="font-semibold text-gray-900">{formatDate(profile.hireDate)}</p>
                    </div>

                    {profile.terminationDate && (
                      <div className="bg-red-50 rounded-xl p-4 col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 text-red-500 mb-2">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">พ้นสภาพ</span>
                        </div>
                        <p className="font-semibold text-red-700">{formatDate(profile.terminationDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignment History */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowAssignments(!showAssignments)}
                  className="w-full px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-500" />
                    ประวัติการดำรงตำแหน่ง
                    {assignments.length > 0 && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {assignments.length}
                      </span>
                    )}
                  </h3>
                  {showAssignments ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {showAssignments && (
                  <div className="p-6">
                    {assignments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">ไม่มีประวัติการดำรงตำแหน่ง</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {assignments.map((assignment, index) => (
                          <div
                            key={assignment.id}
                            className={`relative pl-8 ${index < assignments.length - 1 ? 'pb-4' : ''}`}
                          >
                            {index < assignments.length - 1 && (
                              <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                            )}
                            <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-2 ${
                              assignment.isPrimary && !assignment.effectiveTo
                                ? 'bg-blue-500 border-blue-500'
                                : 'bg-white border-gray-300'
                            }`} />

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {assignment.positionTitle && (
                                    <p className="font-semibold text-gray-900">{assignment.positionTitle}</p>
                                  )}
                                  {assignment.orgUnitName && (
                                    <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                                      <Building2 className="h-3.5 w-3.5" />
                                      {assignment.orgUnitName}
                                    </p>
                                  )}
                                </div>
                                {assignment.isPrimary && !assignment.effectiveTo && (
                                  <Badge variant="success" className="text-xs flex-shrink-0">ปัจจุบัน</Badge>
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
            </div>

            {/* Right Column - Contact & Actions */}
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Phone className="h-5 w-5 text-emerald-500" />
                    ข้อมูลติดต่อ
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">อีเมล</p>
                        <p className="font-medium text-gray-900 group-hover:text-blue-600 truncate text-sm">
                          {profile.email}
                        </p>
                      </div>
                    </a>
                  )}

                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">เบอร์โทร</p>
                        <p className="font-medium text-gray-900 group-hover:text-emerald-600 text-sm">
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

              {/* Authorizations */}
              {profile.authorizations && profile.authorizations.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-amber-500" />
                      สิทธิ์การอนุมัติ
                      <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {profile.authorizations.length}
                      </span>
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {profile.authorizations.map((auth) => (
                      <div
                        key={auth.id}
                        className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <UserCheck className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-amber-800 text-sm">
                            {auth.authType.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          <p className="text-xs text-amber-600">
                            {formatDate(auth.effectiveFrom)}
                            {auth.effectiveTo && ` - ${formatDate(auth.effectiveTo)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Actions - Desktop */}
              {profile.status !== 'terminated' && (
                <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-gray-400" />
                      จัดการสถานะ
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {profile.status === 'active' && (
                      <DxButton
                        icon="pause"
                        text="พักงาน"
                        type="default"
                        stylingMode="outlined"
                        width="100%"
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
                        width="100%"
                        onClick={() => handleStatusChange('active')}
                        disabled={statusMutation.isPending}
                      />
                    )}
                    <DxButton
                      icon="remove"
                      text="พ้นสภาพ"
                      type="danger"
                      stylingMode="outlined"
                      width="100%"
                      onClick={() => handleStatusChange('terminated')}
                      disabled={statusMutation.isPending}
                    />
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  สรุปข้อมูล
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">อายุงาน</span>
                    <span className="font-semibold text-blue-900">
                      {profile.hireDate ? calculateTenure(profile.hireDate) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">สิทธิ์อนุมัติ</span>
                    <span className="font-semibold text-blue-900">
                      {profile.authorizations?.length || 0} รายการ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">ประวัติตำแหน่ง</span>
                    <span className="font-semibold text-blue-900">
                      {assignments.length} รายการ
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
