"use client";

// Position Select Component
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import type { SelectBoxTypes } from 'devextreme-react/select-box';
import type { Position } from '@/types/hr';

export interface PositionSelectProps {
  /** Current value (position ID) */
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
  /** Filter by org unit */
  orgUnitId?: number;
  /** Filter by active status */
  isActive?: boolean;
  /** Additional CSS class */
  className?: string;
}

async function fetchPositions(filters?: {
  orgUnitId?: number;
  isActive?: boolean;
  search?: string;
}): Promise<Position[]> {
  const url = new URL('/api/hr/positions', window.location.origin);
  if (filters?.orgUnitId) {
    url.searchParams.set('orgUnitId', String(filters.orgUnitId));
  }
  if (filters?.isActive !== undefined) {
    url.searchParams.set('isActive', String(filters.isActive));
  }
  if (filters?.search) {
    url.searchParams.set('search', filters.search);
  }

  try {
    const response = await fetch(url.toString());
    const result = await response.json();
    return result.data || [];
  } catch {
    return [];
  }
}

async function getPositionById(id: number): Promise<Position | null> {
  try {
    const response = await fetch(`/api/hr/positions/${id}`);
    const result = await response.json();
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function PositionSelect({
  value,
  onValueChange,
  placeholder = 'เลือกตำแหน่ง...',
  label,
  labelMode = 'floating',
  disabled = false,
  readOnly = false,
  showClearButton = true,
  width,
  orgUnitId,
  isActive = true,
  className,
}: PositionSelectProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load positions on mount and when filters change
  useEffect(() => {
    setIsLoading(true);
    fetchPositions({ orgUnitId, isActive })
      .then(setPositions)
      .finally(() => setIsLoading(false));
  }, [orgUnitId, isActive]);

  // Load selected position data when value changes
  useEffect(() => {
    if (value && !positions.some((p) => p.id === value)) {
      getPositionById(value).then((position) => {
        if (position) {
          setPositions((prev) => {
            if (prev.some((p) => p.id === position.id)) return prev;
            return [...prev, position];
          });
        }
      });
    }
  }, [value, positions]);

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
        const results = await fetchPositions({
          orgUnitId,
          isActive,
          search: searchValue,
        });
        setPositions(results);
      } finally {
        setIsLoading(false);
      }
    },
    [orgUnitId, isActive]
  );

  const displayExpr = (item: Position) => {
    if (!item) return '';
    return `${item.code} - ${item.title}`;
  };

  return (
    <SelectBox
      value={value}
      onValueChanged={handleValueChanged}
      items={positions}
      valueExpr="id"
      displayExpr={displayExpr}
      searchEnabled
      searchExpr={['code', 'title', 'titleEn']}
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
      noDataText={isLoading ? 'กำลังโหลด...' : 'ไม่พบตำแหน่ง'}
      dropDownOptions={{
        height: 300,
      }}
      itemRender={(item: Position) => (
        <div className="py-2 px-1">
          <div className="font-medium text-gray-900">
            {item.title}
            {item.titleEn && (
              <span className="text-gray-500 ml-2 text-sm">
                ({item.titleEn})
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span>{item.code}</span>
            {item.isGmpCritical && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                GMP
              </span>
            )}
            {item.jobGrade && (
              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {item.jobGrade}
              </span>
            )}
          </div>
        </div>
      )}
    />
  );
}
