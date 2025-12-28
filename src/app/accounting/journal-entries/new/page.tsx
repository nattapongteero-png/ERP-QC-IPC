'use client';

/**
 * New Journal Entry Page
 * Feature: 010-accounting-module-integration
 * Follows template pattern with shared JournalEntryForm component
 */

import { JournalEntryForm } from '@/components/accounting';

export default function NewJournalEntryPage() {
  return (
    <div className="p-4 md:p-6">
      <JournalEntryForm mode="create" />
    </div>
  );
}
