'use client';

/**
 * Premises & Facilities (อาคารและสถานที่) — module hub.
 *
 * GMP "Premises and Equipment" grouping. This landing page links to the
 * premises-related records that already live in other modules (storage
 * monitoring, environmental monitoring, sanitation, water quality, equipment
 * maintenance). The sidebar mirrors these same links under this module.
 */

import Link from 'next/link';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Building2,
  Thermometer,
  Droplets,
  Bell,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

const cards = [
  {
    href: '/premises/storage-monitoring',
    icon: Thermometer,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleTh: 'Storage Monitoring',
    titleEn: 'Storage Monitoring',
    desc: 'ติดตามอุณหภูมิ/ความชื้นของคลังจัดเก็บตามเวลา',
  },
  {
    href: '/premises/environmental/inspections',
    icon: Thermometer,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    titleTh: 'ตรวจสภาพแวดล้อม',
    titleEn: 'Environmental Inspection',
    desc: 'บันทึกตรวจสภาพแวดล้อมพื้นที่ผลิตตามรอบ (อุณหภูมิ/ความชื้น/สภาพพื้นที่)',
  },
  {
    href: '/premises/sanitation',
    icon: Sparkles,
    iconBg: 'bg-lime-100',
    iconColor: 'text-lime-600',
    titleTh: 'การจัดการสุขาภิบาล',
    titleEn: 'Sanitation',
    desc: 'บันทึกการทำความสะอาด ตารางสุขาภิบาล แนวโน้ม และการกำจัดสัตว์พาหะ',
  },
  {
    href: '/premises/environmental/water-quality',
    icon: Droplets,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    titleTh: 'ระบบน้ำ (Water Quality)',
    titleEn: 'Water Quality',
    desc: 'คุณภาพน้ำของระบบสาธารณูปโภค (utility) ตามเกณฑ์',
  },
  {
    href: '/premises/notifications',
    icon: Bell,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleTh: 'แจ้งเตือนการบำรุงรักษา',
    titleEn: 'Maintenance Alerts',
    desc: 'งานบำรุงรักษา/สอบเทียบที่ถึงกำหนด + ผลตรวจเกินเกณฑ์ (มีทั้งมุมมองรายการและปฏิทิน)',
  },
];

export default function PremisesHubPage() {
  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title="อาคารและสถานที่"
        subtitle="Premises & Facilities — บันทึกตาม GMP หมวดอาคารสถานที่และเครื่องมือ"
        icon={Building2}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            data-testid={`premises-card-${c.href}`}
            className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
          >
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
              <c.icon className={`h-6 w-6 ${c.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{c.titleTh}</h3>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500" />
              </div>
              <p className="text-xs text-gray-400">{c.titleEn}</p>
              <p className="mt-1 text-sm text-gray-600">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
