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
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Building2,
  Thermometer,
  Droplets,
  Bell,
  Sparkles,
  Scale,
  ChevronRight,
} from 'lucide-react';

const cards = [
  {
    href: '/premises/storage-monitoring',
    icon: Thermometer,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleKey: 'hub.storageMonitoring.title',
    titleEn: 'Storage Monitoring',
    descKey: 'hub.storageMonitoring.desc',
  },
  {
    href: '/premises/environmental/inspections',
    icon: Thermometer,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    titleKey: 'hub.environmentalInspection.title',
    titleEn: 'Environmental Inspection',
    descKey: 'hub.environmentalInspection.desc',
  },
  {
    href: '/premises/equipment-inspection',
    icon: Scale,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    titleKey: 'hub.equipmentInspection.title',
    titleEn: 'Equipment Inspection',
    descKey: 'hub.equipmentInspection.desc',
  },
  {
    href: '/premises/sanitation',
    icon: Sparkles,
    iconBg: 'bg-lime-100',
    iconColor: 'text-lime-600',
    titleKey: 'hub.sanitation.title',
    titleEn: 'Sanitation',
    descKey: 'hub.sanitation.desc',
  },
  {
    href: '/premises/environmental/water-quality',
    icon: Droplets,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    titleKey: 'hub.waterQuality.title',
    titleEn: 'Water Quality',
    descKey: 'hub.waterQuality.desc',
  },
  {
    href: '/premises/notifications',
    icon: Bell,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleKey: 'hub.notifications.title',
    titleEn: 'Maintenance Alerts',
    descKey: 'hub.notifications.desc',
  },
];

export default function PremisesHubPage() {
  const t = useTranslations('premises');
  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={t('hub.title')}
        subtitle={t('hub.subtitle')}
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
                <h3 className="font-semibold text-gray-900">{t(c.titleKey)}</h3>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500" />
              </div>
              <p className="text-xs text-gray-400">{c.titleEn}</p>
              <p className="mt-1 text-sm text-gray-600">{t(c.descKey)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
