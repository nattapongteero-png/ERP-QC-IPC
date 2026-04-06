'use client';

/**
 * Master Data Index Page
 * Dashboard for accessing all master data management pages.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Database,
  Building2,
  Wrench,
  Thermometer,
  FileText,
  Scale,
  FlaskConical,
  ChevronRight
} from 'lucide-react';

const masterDataModules = [
  {
    key: 'productionRooms',
    href: '/master-data/production-rooms',
    icon: Building2,
    iconBgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    key: 'productionEquipment',
    href: '/master-data/production-equipment',
    icon: Wrench,
    iconBgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    key: 'environmentalConditions',
    href: '/master-data/environmental-conditions',
    icon: Thermometer,
    iconBgColor: 'bg-teal-100',
    iconColor: 'text-teal-600',
  },
  {
    key: 'sopTemplates',
    href: '/master-data/sop-templates',
    icon: FileText,
    iconBgColor: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    key: 'packagingQCCriteria',
    href: '/master-data/packaging-qc-criteria',
    icon: Scale,
    iconBgColor: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
  {
    key: 'ipcCriteria',
    href: '/master-data/ipc-criteria',
    icon: FlaskConical,
    iconBgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
];

export default function MasterDataPage() {
  const t = useTranslations('masterData');

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title={t('page.title')}
        subtitle={t('page.description')}
        icon={Database}
        iconBgColor="bg-gray-100"
        iconColor="text-gray-600"
        breadcrumbs={[
          { label: 'Production', href: '/production/work-orders' },
          { label: 'Master Data' },
        ]}
      />

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {masterDataModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${module.iconBgColor} flex items-center justify-center`}>
                <module.icon className={`h-6 w-6 ${module.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {t(`modules.${module.key}.title`)}
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-gray-500 mt-1">{t(`modules.${module.key}.description`)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">{t('about.title')}</h3>
        <p className="text-sm text-blue-700">
          {t('about.description')}
        </p>
        <ul className="mt-3 text-sm text-blue-700 space-y-1">
          <li>• <strong>{t('modules.productionRooms.title')}</strong> - {t('about.items.productionRooms')}</li>
          <li>• <strong>{t('modules.productionEquipment.title')}</strong> - {t('about.items.productionEquipment')}</li>
          <li>• <strong>{t('modules.environmentalConditions.title')}</strong> - {t('about.items.environmentalConditions')}</li>
          <li>• <strong>{t('modules.sopTemplates.title')}</strong> - {t('about.items.sopTemplates')}</li>
          <li>• <strong>{t('modules.packagingQCCriteria.title')}</strong> - {t('about.items.packagingQCCriteria')}</li>
          <li>• <strong>{t('modules.ipcCriteria.title')}</strong> - {t('about.items.ipcCriteria')}</li>
        </ul>
      </div>
    </div>
  );
}
