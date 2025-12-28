'use client';

import React from 'react';

export interface AccountingFilterPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function AccountingFilterPanel({ children, className = '' }: AccountingFilterPanelProps) {
  return (
    <div
      data-testid="filter-panel"
      className={`bg-white/70 backdrop-blur-md rounded-xl border border-gray-200/60 shadow-sm p-4 ${className}`}
    >
      <div className="flex flex-wrap items-end gap-4">
        {children}
      </div>
    </div>
  );
}
