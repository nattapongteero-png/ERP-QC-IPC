'use client';

// HR Module Dashboard
// Feature: 007-hr-personnel-management

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Network,
  Users,
  ClipboardList,
  GraduationCap,
  Shield,
  HeartPulse,
  UserCheck,
  Bell,
  History,
  LayoutGrid,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';

// Fetch quick stats
async function fetchHRStats(): Promise<{
  employeeCount: number;
  activePositions: number;
  pendingNotifications: number;
  expiringTraining: number;
}> {
  try {
    // Fetch notifications count
    const notifResponse = await fetch('/api/hr/notifications?limit=100');
    const notifData = await notifResponse.json();
    const pendingNotifications = notifData.data?.data?.length || 0;
    const expiringTraining = notifData.data?.data?.filter(
      (n: { type: string }) =>
        n.type === 'training_expiring' || n.type === 'training_expired'
    ).length || 0;

    return {
      employeeCount: 0, // Would need separate endpoint
      activePositions: 0, // Would need separate endpoint
      pendingNotifications,
      expiringTraining,
    };
  } catch {
    return {
      employeeCount: 0,
      activePositions: 0,
      pendingNotifications: 0,
      expiringTraining: 0,
    };
  }
}

const modules = [
  {
    title: 'โครงสร้างองค์กร',
    titleEn: 'Organization',
    href: '/hr/org',
    description: 'จัดการโครงสร้างหน่วยงานและผังองค์กร',
    icon: Network,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: 'พนักงาน',
    titleEn: 'Employees',
    href: '/hr/employees',
    description: 'ทะเบียนพนักงานและประวัติการทำงาน',
    icon: Users,
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    title: 'ตำแหน่งงาน',
    titleEn: 'Positions',
    href: '/hr/positions',
    description: 'จัดการตำแหน่งและ Job Description',
    icon: ClipboardList,
    color: 'text-violet-600 bg-violet-100',
  },
  {
    title: 'การอบรม',
    titleEn: 'Training',
    href: '/hr/training',
    description: 'หลักสูตร รอบอบรม และ Competency Matrix',
    icon: GraduationCap,
    color: 'text-amber-600 bg-amber-100',
  },
  {
    title: 'สิทธิ์อนุมัติ',
    titleEn: 'Authorizations',
    href: '/hr/authorizations',
    description: 'การให้สิทธิ์และมอบหมายอำนาจ',
    icon: Shield,
    color: 'text-red-600 bg-red-100',
  },
  {
    title: 'สุขภาพพนักงาน',
    titleEn: 'Health Records',
    href: '/hr/health-records',
    description: 'ผลตรวจสุขภาพและการติดตาม',
    icon: HeartPulse,
    color: 'text-pink-600 bg-pink-100',
  },
  {
    title: 'บทบาท/สิทธิ์',
    titleEn: 'Roles',
    href: '/hr/roles',
    description: 'จัดการบทบาทและสิทธิ์ระบบ',
    icon: UserCheck,
    color: 'text-cyan-600 bg-cyan-100',
  },
  {
    title: 'การแจ้งเตือน',
    titleEn: 'Notifications',
    href: '/hr/notifications',
    description: 'แจ้งเตือนการอบรมและสุขภาพ',
    icon: Bell,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    title: 'Audit Trail',
    titleEn: 'Audit Log',
    href: '/hr/audit',
    description: 'ประวัติการเปลี่ยนแปลงข้อมูล HR',
    icon: History,
    color: 'text-gray-600 bg-gray-100',
  },
];

const quickActions = [
  { label: 'เพิ่มพนักงานใหม่', href: '/hr/employees?action=new', icon: Users },
  { label: 'สร้างหลักสูตร', href: '/hr/training/courses?action=new', icon: GraduationCap },
  { label: 'ดู Competency Matrix', href: '/hr/training/matrix', icon: LayoutGrid },
  { label: 'ตรวจสอบการแจ้งเตือน', href: '/hr/notifications', icon: Bell },
];

export default function HRDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['hr-dashboard-stats'],
    queryFn: fetchHRStats,
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-7 w-7 text-emerald-600" />
          ระบบบริหารงานบุคคล
        </h1>
        <p className="text-gray-500 mt-1">
          HR/Personnel Management Module
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">รอดำเนินการ</p>
              <p className="text-2xl font-bold">{stats?.pendingNotifications || 0}</p>
            </div>
            <Bell className="h-8 w-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">อบรมใกล้หมดอายุ</p>
              <p className="text-2xl font-bold">{stats?.expiringTraining || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">กิจกรรมวันนี้</p>
              <p className="text-2xl font-bold">-</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ต้องดำเนินการ</p>
              <p className="text-2xl font-bold">
                {(stats?.pendingNotifications || 0) > 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-5 w-5" />
                    {stats?.pendingNotifications}
                  </span>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">การดำเนินการด่วน</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">โมดูล HR</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-lg ${module.color} group-hover:scale-110 transition-transform`}
                >
                  <module.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-1">{module.titleEn}</p>
                  <p className="text-sm text-gray-600">{module.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
