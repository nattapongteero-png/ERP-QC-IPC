"use client";

import { useState, useCallback, useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import type { SelectBoxTypes } from 'devextreme-react/select-box';
import type { EmployeeSummary } from '@/types/hr';

export interface EmployeeLookupProps {
  /** Current value (employee ID) */
  value?: number | null;
  /** Change handler */
  onValueChange?: (value: number | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Label mode */
  labelMode?: 'static' | 'floating' | 'hidden' | 'outside';
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Required field */
  required?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Width */
  width?: number | string;
  /** Filter by status */
  status?: 'active' | 'inactive' | 'terminated';
  /** Additional CSS class */
  className?: string;
}

async function searchEmployees(
  searchValue: string,
  status?: string
): Promise<EmployeeSummary[]> {
  const url = new URL('/api/hr/employees/search', window.location.origin);
  if (searchValue) {
    url.searchParams.set('q', searchValue);
  }
  if (status) {
    url.searchParams.set('status', status);
  }

  try {
    const response = await fetch(url.toString());
    const result = await response.json();
    return result.data || [];
  } catch {
    return [];
  }
}

async function getEmployeeById(id: number): Promise<EmployeeSummary | null> {
  try {
    const response = await fetch(`/api/hr/employees/${id}`);
    const result = await response.json();
    if (result.success && result.data) {
      return {
        id: result.data.id,
        employeeCode: result.data.employeeCode,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        fullName: `${result.data.firstName} ${result.data.lastName}`,
        status: result.data.status,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function EmployeeLookup({
  value,
  onValueChange,
  placeholder = 'ค้นหาพนักงาน...',
  label,
  labelMode = 'floating',
  disabled = false,
  readOnly = false,
  showClearButton = true,
  width,
  status = 'active',
  className,
}: EmployeeLookupProps) {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>('');

  // Load selected employee data when value changes
  useEffect(() => {
    if (value) {
      getEmployeeById(value).then((employee) => {
        if (employee) {
          setDisplayValue(`${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`);
          // Add to employees list if not already there
          setEmployees((prev) => {
            if (prev.some((e) => e.id === employee.id)) return prev;
            return [...prev, employee];
          });
        }
      });
    } else {
      setDisplayValue('');
    }
  }, [value]);

  // Initial load
  useEffect(() => {
    searchEmployees('', status).then(setEmployees);
  }, [status]);

  const handleValueChanged = useCallback(
    (e: SelectBoxTypes.ValueChangedEvent) => {
      onValueChange?.(e.value as number | null);
    },
    [onValueChange]
  );

  const handleSearch = useCallback(
    async (searchValue: string) => {
      setIsLoading(true);
      try {
        const results = await searchEmployees(searchValue, status);
        setEmployees(results);
      } finally {
        setIsLoading(false);
      }
    },
    [status]
  );

  const displayExpr = (item: EmployeeSummary) => {
    if (!item) return '';
    return `${item.employeeCode} - ${item.fullName || `${item.firstName} ${item.lastName}`}`;
  };

  return (
    <SelectBox
      value={value}
      onValueChanged={handleValueChanged}
      items={employees}
      valueExpr="id"
      displayExpr={displayExpr}
      searchEnabled
      searchExpr={['employeeCode', 'firstName', 'lastName', 'fullName']}
      searchTimeout={300}
      minSearchLength={0}
      onInput={(e) => {
        const target = e.event?.target as HTMLInputElement | undefined;
        if (target) {
          handleSearch(target.value || '');
        }
      }}
      placeholder={placeholder}
      label={label}
      labelMode={labelMode}
      disabled={disabled || isLoading}
      readOnly={readOnly}
      showClearButton={showClearButton}
      width={width}
      className={className}
      noDataText={isLoading ? 'กำลังค้นหา...' : 'ไม่พบข้อมูลพนักงาน'}
      dropDownOptions={{
        height: 300,
      }}
      itemRender={(item: EmployeeSummary) => (
        <div className="flex items-center gap-3 py-2 px-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
            {item.firstName?.charAt(0)}{item.lastName?.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {item.firstName} {item.lastName}
            </div>
            <div className="text-sm text-gray-500">
              {item.employeeCode}
              {item.positionTitle && ` • ${item.positionTitle}`}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${
            item.status === 'active' ? 'bg-green-100 text-green-700' :
            item.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
            'bg-red-100 text-red-700'
          }`}>
            {item.status === 'active' ? 'ใช้งาน' :
             item.status === 'inactive' ? 'พัก' : 'พ้นสภาพ'}
          </span>
        </div>
      )}
    />
  );
}
