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
import { ResponsivePageHeader, StatCard } from '@/components/shared';

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
  const { data: stats, isLoading } = useQuery({
    queryKey: ['hr-dashboard-stats'],
    queryFn: fetchHRStats,
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8" data-testid="hr-dashboard">
      <ResponsivePageHeader
        title="ระบบบริหารงานบุคคล"
        subtitle="HR/Personnel Management Module"
        icon={Users}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="hr-stat-cards">
        <StatCard
          label="รอดำเนินการ"
          value={stats?.pendingNotifications || 0}
          icon={Bell}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          href="/hr/notifications"
          isLoading={isLoading}
        />

        <StatCard
          label="อบรมใกล้หมดอายุ"
          value={stats?.expiringTraining || 0}
          icon={Clock}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          href="/hr/training"
          trend={
            (stats?.expiringTraining || 0) > 0
              ? { value: String(stats?.expiringTraining || 0), direction: 'up' }
              : undefined
          }
          isLoading={isLoading}
        />

        <StatCard
          label="กิจกรรมวันนี้"
          value="-"
          icon={TrendingUp}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />

        <StatCard
          label="ต้องดำเนินการ"
          value={
            (stats?.pendingNotifications || 0) > 0
              ? stats?.pendingNotifications || 0
              : '-'
          }
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          href="/hr/notifications"
          trend={
            (stats?.pendingNotifications || 0) > 0
              ? { value: String(stats?.pendingNotifications || 0), direction: 'up' }
              : undefined
          }
          isLoading={isLoading}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-4" data-testid="hr-quick-actions">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">การดำเนินการด่วน</h2>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 md:gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center justify-center sm:justify-start gap-2 px-3 md:px-4 py-2.5 md:py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 transition-colors text-xs md:text-sm font-medium min-h-[44px]"
            >
              <action.icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-center sm:text-left">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div data-testid="hr-module-cards">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">โมดูล HR</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="block p-4 md:p-6 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-lg active:scale-[0.98] transition-all group min-h-[44px]"
              data-testid={`hr-module-${module.href.split('/').pop()}`}
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div
                  className={`p-2.5 md:p-3 rounded-lg ${module.color} group-hover:scale-110 transition-transform flex-shrink-0`}
                >
                  <module.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-xs md:text-sm text-gray-500 mb-0.5 md:mb-1">{module.titleEn}</p>
                  <p className="text-xs md:text-sm text-gray-600 line-clamp-2">{module.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
