"use client";

import { User, Mail, Phone, Building2, Briefcase, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Employee, EmployeeSummary } from '@/types/hr';

export interface EmployeeCardProps {
  /** Employee data (full or summary) */
  employee: Employee | EmployeeSummary;
  /** Click handler */
  onClick?: () => void;
  /** Show detailed view */
  detailed?: boolean;
  /** Position title (if not included in employee) */
  positionTitle?: string;
  /** Org unit name (if not included in employee) */
  orgUnitName?: string;
  /** Additional CSS class */
  className?: string;
}

const STATUS_CONFIG = {
  active: { label: 'ใช้งาน', variant: 'success' as const, bgColor: 'bg-green-100', textColor: 'text-green-700' },
  inactive: { label: 'พักงาน', variant: 'warning' as const, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  terminated: { label: 'พ้นสภาพ', variant: 'danger' as const, bgColor: 'bg-red-100', textColor: 'text-red-700' },
};

function isFullEmployee(emp: Employee | EmployeeSummary): emp is Employee {
  return 'email' in emp;
}

export function EmployeeCard({
  employee,
  onClick,
  detailed = false,
  positionTitle,
  orgUnitName,
  className = '',
}: EmployeeCardProps) {
  const statusConfig = STATUS_CONFIG[employee.status] || STATUS_CONFIG.active;
  const fullName = isFullEmployee(employee)
    ? `${employee.firstName} ${employee.lastName}`
    : employee.fullName || `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`;

  // Get position and org unit from full employee or props
  const displayPositionTitle = positionTitle || (isFullEmployee(employee) ? undefined : employee.positionTitle);
  const displayOrgUnitName = orgUnitName || (isFullEmployee(employee) ? undefined : employee.orgUnitName);

  if (!detailed) {
    // Compact card view
    return (
      <div
        onClick={onClick}
        className={`
          bg-white rounded-lg border border-gray-200 p-4
          ${onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all' : ''}
          ${className}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{fullName}</h4>
              <Badge variant={statusConfig.variant} className="text-xs shrink-0">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 truncate">
              {employee.employeeCode}
              {displayPositionTitle && ` • ${displayPositionTitle}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Detailed card view
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl border border-gray-200 overflow-hidden
        ${onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''}
        ${className}
      `}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
          <div className="text-white">
            <h3 className="text-lg font-semibold">{fullName}</h3>
            <p className="text-blue-100">{employee.employeeCode}</p>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {displayPositionTitle && (
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">ตำแหน่ง</p>
              <p className="text-sm font-medium text-gray-900">{displayPositionTitle}</p>
            </div>
          </div>
        )}

        {displayOrgUnitName && (
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">หน่วยงาน</p>
              <p className="text-sm font-medium text-gray-900">{displayOrgUnitName}</p>
            </div>
          </div>
        )}

        {isFullEmployee(employee) && (
          <>
            {employee.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">อีเมล</p>
                  <p className="text-sm font-medium text-gray-900">{employee.email}</p>
                </div>
              </div>
            )}

            {employee.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">เบอร์โทร</p>
                  <p className="text-sm font-medium text-gray-900">{employee.phone}</p>
                </div>
              </div>
            )}

            {employee.hireDate && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">วันที่เริ่มงาน</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(employee.hireDate).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
