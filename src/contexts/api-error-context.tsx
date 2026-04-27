'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ErrorDetails {
  message: string;
  stack?: string;
  name?: string;
  cause?: string;
  code?: string;
  path?: string;
  timestamp: string;
}

interface ApiError {
  id: string;
  error: string;
  debug?: ErrorDetails;
  url?: string;
  method?: string;
  dismissedAt?: number;
  // Permission-denial context (populated when backend returns 403 with
  // missing permission info). See buildMissingPermissionResponse() in
  // src/lib/api-utils.ts — these fields let the toast highlight exactly
  // which permission is missing so admins can fix role assignments quickly.
  missingPermissions?: string[];
  userRole?: string;
  actionHint?: string;
}

interface ApiErrorContextType {
  errors: ApiError[];
  addError: (error: Omit<ApiError, 'id'>) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
}

const ApiErrorContext = createContext<ApiErrorContextType | null>(null);

export function useApiErrors() {
  const context = useContext(ApiErrorContext);
  if (!context) {
    throw new Error('useApiErrors must be used within ApiErrorProvider');
  }
  return context;
}

export function ApiErrorProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<ApiError[]>([]);

  const addError = useCallback((error: Omit<ApiError, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setErrors((prev) => [...prev, { ...error, id }]);
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <ApiErrorContext.Provider value={{ errors, addError, dismissError, clearErrors }}>
      {children}
    </ApiErrorContext.Provider>
  );
}
