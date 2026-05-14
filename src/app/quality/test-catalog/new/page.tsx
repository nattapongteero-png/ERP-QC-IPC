'use client';

import { QcTestCatalogForm } from '@/components/quality/qc-test-catalog-form';

export default function NewQcTestCatalogPage() {
  return (
    <div className="p-4">
      <QcTestCatalogForm mode="create" />
    </div>
  );
}
