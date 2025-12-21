/**
 * StatCard Component Contract
 * Feature: 007-hr-personnel-management
 * Date: 2025-12-21
 *
 * A summary statistic card for dashboards showing key metrics.
 * Supports optional trends, icons, and click interactions.
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Trend indicator for stat changes
 */
export interface TrendIndicator {
  /** Direction of the trend */
  direction: 'up' | 'down' | 'neutral';
  /** Display value (e.g., "+5.2%", "-3 items") */
  value: string;
}

/**
 * Props for StatCard component
 */
export interface StatCardProps {
  // === Required Props ===

  /** Label text describing the statistic */
  label: string;

  /** The main value to display (number or formatted string) */
  value: string | number;

  // === Optional Props ===

  /** Icon component from lucide-react */
  icon?: LucideIcon;

  /** Icon color class (e.g., "text-emerald-500") */
  iconColor?: string;

  /** Left border accent color (e.g., "border-emerald-500") */
  accentColor?: string;

  /** Trend indicator showing change */
  trend?: TrendIndicator;

  /** Click handler for interactive cards */
  onClick?: () => void;

  /** Link destination - makes entire card clickable */
  href?: string;

  /** Loading state - shows skeleton */
  isLoading?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Component Behavior Contract:
 *
 * 1. VISUAL STRUCTURE:
 *    ┌─────────────────────────────────┐
 *    │▌ Label text              [Icon] │
 *    │▌ 42 (large, bold)               │
 *    │▌ ↑ +5.2% (optional trend)       │
 *    └─────────────────────────────────┘
 *
 * 2. ACCENT BORDER:
 *    - 4px left border using accentColor
 *    - Default: border-emerald-500
 *
 * 3. INTERACTIVITY:
 *    - If onClick or href provided, show hover effect
 *    - Cursor changes to pointer
 *    - Subtle scale/shadow on hover
 *
 * 4. TREND DISPLAY:
 *    - "up" trend: green color with ↑ arrow
 *    - "down" trend: red color with ↓ arrow
 *    - "neutral" trend: gray color with → arrow
 *
 * 5. LOADING STATE:
 *    - Shows animated skeleton for value
 *    - Label and icon remain visible
 *
 * 6. RESPONSIVE:
 *    - Cards work in 2-column grid on mobile
 *    - 4-column grid on tablet+
 *    - Min-height ensures consistent sizing
 */

// Example Usage:
/*
import { Bell, Clock, Users, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';

// Grid of stat cards
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <StatCard
    label="รอดำเนินการ"
    value={42}
    icon={Bell}
    iconColor="text-emerald-500"
    accentColor="border-emerald-500"
    onClick={() => router.push('/hr/notifications')}
  />
  <StatCard
    label="อบรมใกล้หมดอายุ"
    value={5}
    icon={Clock}
    iconColor="text-yellow-500"
    accentColor="border-yellow-500"
    trend={{ direction: 'up', value: '+2 จากเดือนก่อน' }}
  />
  <StatCard
    label="พนักงานทั้งหมด"
    value={156}
    icon={Users}
    iconColor="text-blue-500"
    accentColor="border-blue-500"
    href="/hr/employees"
  />
  <StatCard
    label="ต้องดำเนินการ"
    value={3}
    icon={AlertTriangle}
    iconColor="text-red-500"
    accentColor="border-red-500"
  />
</div>
*/

// CSS Classes Reference:
/*
Container:
  "bg-white rounded-lg shadow p-4 border-l-4" + accentColor

Clickable variant:
  "hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"

Layout:
  "flex items-center justify-between"

Label:
  "text-sm text-gray-500"

Value:
  "text-2xl font-bold"

Icon:
  "h-8 w-8" + iconColor

Trend (up):
  "text-xs text-green-600 flex items-center gap-1 mt-1"

Trend (down):
  "text-xs text-red-600 flex items-center gap-1 mt-1"

Loading skeleton:
  "h-8 w-16 bg-gray-200 rounded animate-pulse"
*/
