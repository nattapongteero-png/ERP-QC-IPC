'use client';

/**
 * GMP Compliance (ระบบคุณภาพตาม GMP) — module hub.
 *
 * The sidebar's "GMP Compliance" parent points at /gmp. Without this page the
 * href 404s on prefetch and on direct URL entry / bookmark. Mirrors the
 * sidebar children as cards, same pattern as the Premises hub.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Shield,
  FileSearch,
  Sparkles,
  History,
  Target,
  MessageSquare,
  Undo2,
  FlaskConical,
  Search,
  Briefcase,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

const cards = [
  {
    href: '/gmp/documents',
    icon: FileSearch,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleKey: 'hub.documents.title',
    titleEn: 'Quality Documents',
    descKey: 'hub.documents.desc',
  },
  {
    href: '/gmp/documents/assistant',
    icon: Sparkles,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    titleKey: 'hub.assistant.title',
    titleEn: 'SOP Assistant',
    descKey: 'hub.assistant.desc',
  },
  {
    href: '/gmp/changes',
    icon: History,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleKey: 'hub.changes.title',
    titleEn: 'Change Control',
    descKey: 'hub.changes.desc',
  },
  {
    href: '/gmp/capa',
    icon: Target,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    titleKey: 'hub.capa.title',
    titleEn: 'CAPA',
    descKey: 'hub.capa.desc',
  },
  {
    href: '/gmp/complaints',
    icon: MessageSquare,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    titleKey: 'hub.complaints.title',
    titleEn: 'Complaints',
    descKey: 'hub.complaints.desc',
  },
  {
    href: '/gmp/recalls',
    icon: Undo2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    titleKey: 'hub.recalls.title',
    titleEn: 'Product Recalls',
    descKey: 'hub.recalls.desc',
  },
  {
    href: '/gmp/stability',
    icon: FlaskConical,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    titleKey: 'hub.stability.title',
    titleEn: 'Stability Studies',
    descKey: 'hub.stability.desc',
  },
  {
    href: '/gmp/internal-audit',
    icon: Search,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    titleKey: 'hub.internalAudit.title',
    titleEn: 'Internal Audit',
    descKey: 'hub.internalAudit.desc',
  },
  {
    href: '/gmp/contracts',
    icon: Briefcase,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    titleKey: 'hub.contracts.title',
    titleEn: 'Contract Manufacturing',
    descKey: 'hub.contracts.desc',
  },
  {
    href: '/gmp/pqr',
    icon: BarChart3,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleKey: 'hub.pqr.title',
    titleEn: 'PQR',
    descKey: 'hub.pqr.desc',
  },
];

export default function GmpHubPage() {
  const t = useTranslations('gmp');
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
            data-testid={`gmp-card-${c.href}`}
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
