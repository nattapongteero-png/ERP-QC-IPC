'use client';

/**
 * Journal Entry Detail/Edit Page
 * Feature: 010-accounting-module-integration
 * Follows template pattern with shared JournalEntryForm component
 */

import { use } from 'react';
import { JournalEntryForm } from '@/components/accounting';

interface Props {
  params: Promise<{ id: string }>;
}

export default function JournalEntryDetailPage({ params }: Props) {
  const { id } = use(params);
  const entryId = Number(id);

  if (isNaN(entryId) || entryId <= 0) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center text-red-600">
          Invalid entry ID
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <JournalEntryForm mode="edit" entryId={entryId} />
    </div>
  );
}
