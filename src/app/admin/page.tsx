'use client';

/**
 * Administration (ผู้ดูแลระบบ) — module hub.
 *
 * The sidebar's "Admin" parent points at /admin. Without this page the href
 * 404s on prefetch and on direct URL entry / bookmark. Mirrors the sidebar
 * children as cards, same pattern as the Premises hub.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Shield, ShieldCheck, ChevronRight } from 'lucide-react';

const cards = [
  {
    href: '/admin/confidential-groups',
    icon: ShieldCheck,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    titleKey: 'hub.confidentialGroups.title',
    titleEn: 'Confidential Groups',
    descKey: 'hub.confidentialGroups.desc',
  },
];

export default function AdminHubPage() {
  const t = useTranslations('admin');
  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={t('hub.title')}
        subtitle={t('hub.subtitle')}
        icon={Shield}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            data-testid={`admin-card-${c.href}`}
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
