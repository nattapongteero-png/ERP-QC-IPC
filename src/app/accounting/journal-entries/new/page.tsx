'use client';

/**
 * New Journal Entry Page
 * Feature: 010-accounting-module-integration
 * Follows template pattern with shared JournalEntryForm component
 */

import { useTranslations } from 'next-intl';
import { JournalEntryForm } from '@/components/accounting';

export default function NewJournalEntryPage() {
  const t = useTranslations('accounting');
  return (
    <div className="p-4 md:p-6" data-title={t('page.title')}>
      <JournalEntryForm mode="create" />
    </div>
  );
}
