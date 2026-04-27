'use client';

import { use } from 'react';
import { QcTestCatalogForm } from '@/components/quality/qc-test-catalog-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditQcTestCatalogPage({ params }: Props) {
  const { id } = use(params);
  return (
    <div className="p-4">
      <QcTestCatalogForm mode="edit" id={Number(id)} />
    </div>
  );
}
