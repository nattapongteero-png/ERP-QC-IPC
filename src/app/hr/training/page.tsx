'use client';

// HR Training Module Landing Page
// Feature: 007-hr-personnel-management

import Link from 'next/link';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  LayoutGrid,
} from 'lucide-react';

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
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-amber-600" />
          ระบบจัดการการอบรม
        </h1>
        <p className="text-gray-500 mt-1">
          Training Management Module
        </p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {trainingModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-lg ${module.color} group-hover:scale-110 transition-transform`}
              >
                <module.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
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
  );
}
