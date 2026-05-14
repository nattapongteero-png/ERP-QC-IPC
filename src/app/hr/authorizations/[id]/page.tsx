'use client';

// HR Authorization Detail/Edit Page
// Feature: 007-hr-personnel-management
// Follows template module patterns

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { AuthorizationForm } from '@/components/hr/AuthorizationForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AuthorizationDetailPage({ params }: Props) {
  const t = useTranslations('hr');
  const { id } = use(params);
  const authorizationId = Number(id);

  return (
    <div className="p-4 md:p-6" data-title={t('authorizations.actions.viewAuthorization')}>
      <AuthorizationForm mode="edit" authorizationId={authorizationId} />
    </div>
  );
}
