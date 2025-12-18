'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ItemCategory {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ItemUnit {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  symbol: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface UseLookupDataResult<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Generic hook for fetching lookup data
function useLookupData<T>(endpoint: string): UseLookupDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Network error');
      console.error('Failed to fetch lookup data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// Hook for item categories
export function useItemCategories(): UseLookupDataResult<ItemCategory> {
  return useLookupData<ItemCategory>('/api/item-categories');
}

// Hook for item units
export function useItemUnits(): UseLookupDataResult<ItemUnit> {
  return useLookupData<ItemUnit>('/api/item-units');
}

// Helper to convert categories to select options
export function categoriesToOptions(categories: ItemCategory[], includeEmpty = true) {
  const options = categories.map(cat => ({
    value: cat.code,
    label: cat.nameEn || cat.nameTh,
  }));

  if (includeEmpty) {
    return [{ value: '', label: 'Select Category' }, ...options];
  }
  return options;
}

// Helper to convert units to select options
export function unitsToOptions(units: ItemUnit[], includeEmpty = false) {
  const options = units.map(unit => ({
    value: unit.code,
    label: unit.nameEn ? `${unit.nameEn} (${unit.symbol || unit.code})` : `${unit.nameTh} (${unit.symbol || unit.code})`,
  }));

  if (includeEmpty) {
    return [{ value: '', label: 'None' }, ...options];
  }
  return options;
}
