/**
 * MobileListView Component Contract
 * Feature: 007-hr-personnel-management
 * Date: 2025-12-21
 *
 * A card-based list view optimized for mobile devices.
 * Used as an alternative to DataGrid on small screens.
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Swipe action configuration
 */
export interface SwipeAction<T = unknown> {
  /** Unique action identifier */
  id: string;

  /** Action label text */
  label: string;

  /** Icon component */
  icon?: LucideIcon;

  /** Background color variant */
  color: 'primary' | 'success' | 'warning' | 'danger';

  /** Swipe direction to reveal this action */
  direction: 'left' | 'right';

  /** Action handler */
  onAction: (item: T) => void;
}

/**
 * Props for MobileListView component
 */
export interface MobileListViewProps<T = unknown> {
  // === Required Props ===

  /** Data source */
  items: T[];

  /** Unique key field in each item */
  keyExpr: keyof T | string;

  /** Card renderer function */
  renderCard: (item: T, index: number) => React.ReactNode;

  // === Optional Props ===

  /** Item click handler */
  onItemClick?: (item: T) => void;

  /** Swipe actions (currently future feature) */
  swipeActions?: SwipeAction<T>[];

  /** Loading state */
  isLoading?: boolean;

  /** Message when list is empty */
  emptyMessage?: string;

  /** Empty state icon */
  emptyIcon?: LucideIcon;

  /** Pull to refresh handler */
  onRefresh?: () => Promise<void>;

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

/**
 * Component Behavior Contract:
 *
 * 1. CARD RENDERING:
 *    - Each item rendered using renderCard function
 *    - Cards have consistent padding and shadow
 *    - Clickable cards show hover/active states
 *
 * 2. EMPTY STATE:
 *    - Shows emptyMessage when items array is empty
 *    - Optional emptyIcon displayed above message
 *    - Centered in container
 *
 * 3. LOADING STATE:
 *    - Initial load: Shows skeleton cards (3-5)
 *    - Loading more: Shows spinner at bottom
 *
 * 4. PULL TO REFRESH (future):
 *    - Triggered by pulling down from top
 *    - Shows refresh indicator
 *    - Calls onRefresh and waits for promise
 *
 * 5. INFINITE SCROLL:
 *    - Triggers onLoadMore when scrolled near bottom
 *    - Shows loading indicator when isLoadingMore=true
 *    - Stops loading when hasMore=false
 *
 * 6. SWIPE ACTIONS (future):
 *    - Swipe left/right to reveal action buttons
 *    - Actions configured per direction
 *    - Color variants for visual distinction
 */

// Example Usage:
/*
import { MobileListView } from '@/components/shared/mobile-list-view';
import { User, Phone } from 'lucide-react';

interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  position: string;
  department: string;
  phone: string;
  status: 'active' | 'inactive';
}

<MobileListView
  items={employees}
  keyExpr="id"
  onItemClick={(emp) => router.push(`/hr/employees/${emp.id}`)}
  emptyMessage="ไม่พบข้อมูลพนักงาน"
  emptyIcon={User}
  isLoading={isLoading}
  onLoadMore={loadNextPage}
  hasMore={hasNextPage}
  isLoadingMore={isFetchingNextPage}
  gap="md"
  renderCard={(employee) => (
    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
        <User className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 truncate">
            {employee.employeeCode} - {employee.fullName}
          </p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
            employee.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {employee.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
          </span>
        </div>
        <p className="text-sm text-gray-500">{employee.position}</p>
        <p className="text-sm text-gray-500">{employee.department}</p>
        {employee.phone && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            <Phone className="h-3 w-3" />
            {employee.phone}
          </div>
        )}
      </div>
    </div>
  )}
/>
*/

// CSS Classes Reference:
/*
Container:
  "flex flex-col" + gap classes

Gap variants:
  sm: "gap-2"
  md: "gap-3"
  lg: "gap-4"

Card wrapper (clickable):
  "cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"

Empty state:
  "flex flex-col items-center justify-center py-12 text-gray-500"

Loading skeleton:
  "animate-pulse bg-gray-200 rounded-lg h-24"

Load more trigger:
  "py-4 text-center text-gray-500"
*/
