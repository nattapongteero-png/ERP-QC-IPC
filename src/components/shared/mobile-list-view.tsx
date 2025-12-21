'use client';

/**
 * MobileListView Component
 * Feature: 007-hr-personnel-management
 *
 * A card-based list view optimized for mobile devices.
 * Used as an alternative to DataGrid on small screens.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox, Loader2 } from 'lucide-react';

export interface MobileListViewProps<T = unknown> {
  /** Data source */
  items: T[];
  /** Unique key field in each item */
  keyExpr: keyof T | string;
  /** Card renderer function */
  renderCard: (item: T, index: number) => React.ReactNode;
  /** Item click handler */
  onItemClick?: (item: T) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Message when list is empty */
  emptyMessage?: string;
  /** Empty state icon */
  emptyIcon?: LucideIcon;
  /** Infinite scroll - load more handler */
  onLoadMore?: () => Promise<void>;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Loading more indicator */
  isLoadingMore?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Gap between cards */
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export function MobileListView<T>({
  items,
  keyExpr,
  renderCard,
  onItemClick,
  isLoading = false,
  emptyMessage = 'No items found',
  emptyIcon: EmptyIcon = Inbox,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  className = '',
  gap = 'md',
}: MobileListViewProps<T>) {
  const getKey = (item: T): string | number => {
    const key = typeof keyExpr === 'string'
      ? (item as Record<string, unknown>)[keyExpr]
      : item[keyExpr];
    return key as string | number;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`flex flex-col ${gapClasses[gap]} ${className}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-200 rounded-lg h-24"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-gray-500 ${className}`}>
        <EmptyIcon className="h-12 w-12 mb-4 text-gray-400" />
        <p className="text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${gapClasses[gap]} ${className}`}>
      {items.map((item, index) => (
        <div
          key={getKey(item)}
          onClick={() => onItemClick?.(item)}
          className={onItemClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98] transition-all' : ''}
        >
          {renderCard(item, index)}
        </div>
      ))}

      {/* Load more section */}
      {hasMore && (
        <div className="py-4 text-center">
          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            <button
              onClick={() => onLoadMore?.()}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MobileListView;
