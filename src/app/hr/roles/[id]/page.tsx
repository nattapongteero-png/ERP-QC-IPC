'use client';

// Edit Role Page
// Feature: 007-hr-personnel-management

import { use } from 'react';
import { RoleForm } from '@/components/hr/role-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditRolePage({ params }: PageProps) {
  const { id } = use(params);
  const roleId = parseInt(id, 10);

  if (isNaN(roleId)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">Invalid role ID</p>
      </div>
    );
  }

  return <RoleForm mode="edit" roleId={roleId} />;
}
