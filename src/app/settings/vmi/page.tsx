'use client';

/**
 * VMI Portal Settings Page
 *
 * Settings page for managing VMI Portal connections.
 * This system IS the vendor - configures connections TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { VmiPortalList } from '@/components/settings/vmi';
import { DxButton } from '@/components/ui/dx-button';
import Link from 'next/link';

export default function VmiSettingsPage() {
  const t = useTranslations('settings');

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={t('vmiSettings.title')}
          description={t('vmiSettings.description')}
          breadcrumb={
            <nav className="flex text-sm text-gray-500">
              <Link href="/settings" className="hover:text-gray-700">{t('page.title')}</Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900">{t('vmiSettings.vmiPortals')}</span>
            </nav>
          }
          actions={
            <Link href="/settings">
              <DxButton
                text={t('vmiSettings.backToSettings')}
                icon="arrowleft"
                type="normal"
              />
            </Link>
          }
        />

        <VmiPortalList />

        {/* Help Section */}
        <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">{t('vmiSettings.aboutTitle')}</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>{t('vmiSettings.whatIsVmi')}</strong> {t('vmiSettings.whatIsVmiDescription')}
            </p>
            <p>
              <strong>{t('vmiSettings.howItWorks')}</strong>
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>{t('vmiSettings.inventorySync')}</strong></li>
              <li><strong>{t('vmiSettings.itemsSync')}</strong></li>
              <li><strong>{t('vmiSettings.pricesSync')}</strong></li>
              <li><strong>{t('vmiSettings.orderPolling')}</strong></li>
            </ul>
            <p className="mt-4">
              <strong>{t('vmiSettings.gettingStarted')}</strong> {t('vmiSettings.gettingStartedDescription')}
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
