'use client';

// HR Module Dashboard
// Feature: 007-hr-personnel-management

import Link from 'next/link';

export default function HRDashboardPage() {
  const modules = [
    {
      title: 'โครงสร้างองค์กร',
      titleEn: 'Organization Structure',
      href: '/hr/org-chart',
      description: 'จัดการโครงสร้างหน่วยงานและผังองค์กร',
      icon: '🏢',
    },
    {
      title: 'พนักงาน',
      titleEn: 'Employees',
      href: '/hr/employees',
      description: 'ทะเบียนพนักงานและประวัติการทำงาน',
      icon: '👥',
    },
    {
      title: 'ตำแหน่งงาน',
      titleEn: 'Positions',
      href: '/hr/positions',
      description: 'จัดการตำแหน่งและ Job Description',
      icon: '📋',
    },
    {
      title: 'หลักสูตรอบรม',
      titleEn: 'Training Courses',
      href: '/hr/training/courses',
      description: 'หลักสูตรฝึกอบรมและความถูกต้อง',
      icon: '📚',
    },
    {
      title: 'Competency Matrix',
      titleEn: 'Competency Matrix',
      href: '/hr/training/matrix',
      description: 'ตารางทักษะและการรับรอง',
      icon: '📊',
    },
    {
      title: 'สิทธิ์อนุมัติ',
      titleEn: 'Authorizations',
      href: '/hr/authorizations',
      description: 'การให้สิทธิ์และมอบหมายอำนาจ',
      icon: '✅',
    },
    {
      title: 'บทบาท',
      titleEn: 'Roles',
      href: '/hr/roles',
      description: 'จัดการบทบาทและสิทธิ์ระบบ',
      icon: '🔐',
    },
    {
      title: 'Audit Log',
      titleEn: 'Audit Log',
      href: '/hr/audit',
      description: 'ประวัติการเปลี่ยนแปลงข้อมูล HR',
      icon: '📜',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          ระบบบริหารงานบุคคล
        </h1>
        <p className="text-gray-600 mt-1">
          HR/Personnel Management Module
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="text-4xl mb-4">{module.icon}</div>
            <h2 className="text-lg font-semibold text-gray-900">
              {module.title}
            </h2>
            <p className="text-sm text-gray-500 mb-2">{module.titleEn}</p>
            <p className="text-sm text-gray-600">{module.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
