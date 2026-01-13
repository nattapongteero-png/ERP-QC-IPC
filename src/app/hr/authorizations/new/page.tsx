'use client';

// HR Authorizations New Page
// Feature: 007-hr-personnel-management
// Follows template module patterns

import { AuthorizationForm } from '@/components/hr/AuthorizationForm';

export default function NewAuthorizationPage() {
  return (
    <div className="p-4 md:p-6">
      <AuthorizationForm mode="create" />
    </div>
  );
}
