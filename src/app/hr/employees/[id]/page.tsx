'use client';

// HR Employee Profile Page
// Feature: 007-hr-personnel-management

import { use } from 'react';

interface EmployeeProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function EmployeeProfilePage({ params }: EmployeeProfilePageProps) {
  const { id } = use(params);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          ข้อมูลพนักงาน
        </h1>
        <p className="text-gray-600 mt-1">
          Employee Profile - ID: {id}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-500 text-center py-12">
            TODO: Implement Employee Profile with tabs for assignments, training, authorizations
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-500 text-center py-12">
            TODO: Employee quick actions and status
          </p>
        </div>
      </div>
    </div>
  );
}
