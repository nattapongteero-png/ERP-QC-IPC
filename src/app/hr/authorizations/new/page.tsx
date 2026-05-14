'use client';

// HR Authorizations New Page
// Feature: 007-hr-personnel-management
// Follows template module patterns

import { useTranslations } from 'next-intl';
import { AuthorizationForm } from '@/components/hr/AuthorizationForm';

export default function NewAuthorizationPage() {
  const t = useTranslations('hr');
  return (
    <div className="p-4 md:p-6" data-title={t('authorizations.actions.addAuthorization')}>
      <AuthorizationForm mode="create" />
    </div>
  );
}
