'use client';

// HR Edit Employee Page
// Feature: 007-hr-personnel-management

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmployeeForm } from '@/components/hr';
import { Loader2, AlertCircle } from 'lucide-react';
import type { EmployeeProfile } from '@/types/hr';

async function fetchEmployeeProfile(id: string): Promise<EmployeeProfile> {
  const response = await fetch(`/api/hr/employees/${id}`);
  if (!response.ok) throw new Error('Failed to fetch employee profile');
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch employee profile');
  return result.data;
}

export default function EditEmployeePage() {
  const params = useParams();
  const employeeId = params.id as string;

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['hr', 'employee', employeeId],
    queryFn: () => fetchEmployeeProfile(employeeId),
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-sm w-full shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">ไม่พบข้อมูลพนักงาน</h2>
          <p className="text-gray-500 text-sm mb-6">ข้อมูลพนักงานที่คุณต้องการแก้ไขไม่มีในระบบ</p>
          <Link
            href="/hr/employees"
            className="block w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-center"
          >
            กลับหน้ารายการ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <EmployeeForm
      mode="edit"
      employeeId={employeeId}
      initialData={profile}
    />
  );
}
