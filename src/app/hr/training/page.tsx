'use client';

// HR Training Module Landing Page
// Feature: 007-hr-personnel-management

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ResponsivePageHeader, StatCard } from '@/components/shared';

// Fetch training stats
async function fetchTrainingStats(): Promise<{
  totalCourses: number;
  activeSessions: number;
  completedThisMonth: number;
  expiringCertifications: number;
}> {
  try {
    // Fetch courses count
    const coursesRes = await fetch('/api/hr/training/courses');
    const coursesData = await coursesRes.json();
    const totalCourses = coursesData.data?.length || 0;

    // Fetch sessions
    const sessionsRes = await fetch('/api/hr/training/sessions');
    const sessionsData = await sessionsRes.json();
    const sessions = sessionsData.data || [];
    const activeSessions = sessions.filter(
      (s: { status: string }) => s.status === 'scheduled' || s.status === 'in_progress'
    ).length;

    return {
      totalCourses,
      activeSessions,
      completedThisMonth: 0, // Would need additional endpoint
      expiringCertifications: 0, // Would need additional endpoint
    };
  } catch {
    return {
      totalCourses: 0,
      activeSessions: 0,
      completedThisMonth: 0,
      expiringCertifications: 0,
    };
  }
}

const trainingModules = [
  {
    title: 'หลักสูตรอบรม',
    titleEn: 'Training Courses',
    href: '/hr/training/courses',
    description: 'จัดการหลักสูตรและเนื้อหาการอบรม',
    icon: BookOpen,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: 'รอบอบรม',
    titleEn: 'Training Sessions',
    href: '/hr/training/sessions',
    description: 'จัดตารางและบันทึกรอบการอบรม',
    icon: Calendar,
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    title: 'Competency Matrix',
    titleEn: 'Skills Matrix',
    href: '/hr/training/matrix',
    description: 'ตารางทักษะและความสามารถพนักงาน',
    icon: LayoutGrid,
    color: 'text-violet-600 bg-violet-100',
  },
];

export default function TrainingLandingPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['hr', 'training', 'stats'],
    queryFn: fetchTrainingStats,
    refetchInterval: 60000,
  });

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
      {/* T022: ResponsivePageHeader */}
      <ResponsivePageHeader
        title="ระบบจัดการการอบรม"
        subtitle="Training Management Module"
        icon={GraduationCap}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'การอบรม' },
        ]}
      />

      {/* T023: StatCard components for training stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="หลักสูตรทั้งหมด"
          value={stats?.totalCourses || 0}
          icon={BookOpen}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          href="/hr/training/courses"
          isLoading={isLoading}
        />
        <StatCard
          label="รอบที่กำลังดำเนินการ"
          value={stats?.activeSessions || 0}
          icon={Calendar}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          href="/hr/training/sessions"
          isLoading={isLoading}
        />
        <StatCard
          label="สำเร็จเดือนนี้"
          value={stats?.completedThisMonth || 0}
          icon={CheckCircle2}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ใบรับรองใกล้หมดอายุ"
          value={stats?.expiringCertifications || 0}
          icon={AlertTriangle}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          trend={
            (stats?.expiringCertifications || 0) > 0
              ? { value: String(stats?.expiringCertifications || 0), direction: 'up' }
              : undefined
          }
          isLoading={isLoading}
        />
      </div>

      {/* T024: Module Cards - Responsive grid (1-col mobile, 3-col desktop) */}
      <div>
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">โมดูลการอบรม</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {trainingModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="block p-4 md:p-6 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-lg active:scale-[0.98] transition-all group min-h-[44px]"
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div
                  className={`p-2.5 md:p-3 rounded-lg ${module.color} group-hover:scale-110 transition-transform flex-shrink-0`}
                >
                  <module.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
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
