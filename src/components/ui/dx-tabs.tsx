"use client";

import Tabs, { Item as TabItem } from 'devextreme-react/tabs';
import type { TabsTypes } from 'devextreme-react/tabs';

// Re-export Item as DxTabItem for declarative tab definition
export { TabItem as DxTabItem };

export interface DxTabItemData {
  /** Optional id - auto-generated from index if not provided */
  id?: number;
  text: string;
  icon?: string;
  disabled?: boolean;
  badge?: string | number;
  visible?: boolean;
}

export interface DxTabsProps {
  /** Tab items */
  items?: DxTabItemData[];
  /** Children (alternative to items prop) */
  children?: React.ReactNode;
  /** Selected tab index */
  selectedIndex?: number;
  /** Selected index change handler */
  onSelectedIndexChange?: (index: number) => void;
  /** Item click handler */
  onItemClick?: (e: TabsTypes.ItemClickEvent) => void;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Show navigation buttons when tabs overflow */
  showNavButtons?: boolean;
  /** Scroll by content */
  scrollByContent?: boolean;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Selection mode */
  selectionMode?: 'single' | 'multiple';
  /** Icon position */
  iconPosition?: 'top' | 'start' | 'end' | 'bottom';
  /** Styling mode */
  stylingMode?: 'primary' | 'secondary';
  /** Additional CSS class */
  className?: string;
  /** Tab item render function */
  itemRender?: (itemData: DxTabItemData) => React.ReactNode;
  /** Option changed handler (for declarative usage with children) */
  onOptionChanged?: (e: { name: string; value: unknown }) => void;
}

/**
 * DevExtreme Tabs wrapper for tab navigation
 *
 * @example
 * ```tsx
 * // Basic usage
 * const tabs: DxTabItem[] = [
 *   { id: 0, text: 'Overview' },
 *   { id: 1, text: 'Details' },
 *   { id: 2, text: 'History' },
 * ];
 *
 * <DxTabs
 *   items={tabs}
 *   selectedIndex={activeTab}
 *   onSelectedIndexChange={setActiveTab}
 * />
 *
 * // With icons
 * const tabsWithIcons: DxTabItem[] = [
 *   { id: 0, text: 'Home', icon: 'home' },
 *   { id: 1, text: 'Settings', icon: 'preferences' },
 * ];
 *
 * <DxTabs
 *   items={tabsWithIcons}
 *   selectedIndex={activeTab}
 *   onSelectedIndexChange={setActiveTab}
 *   iconPosition="start"
 * />
 *
 * // With badges
 * const tabsWithBadges: DxTabItem[] = [
 *   { id: 0, text: 'Orders', badge: 5 },
 *   { id: 1, text: 'Messages', badge: 12 },
 * ];
 *
 * <DxTabs
 *   items={tabsWithBadges}
 *   selectedIndex={activeTab}
 *   onSelectedIndexChange={setActiveTab}
 * />
 * ```
 */
export function DxTabs({
  items,
  children,
  selectedIndex = 0,
  onSelectedIndexChange,
  onOptionChanged,
  onItemClick,
  width,
  height,
  showNavButtons = true,
  scrollByContent = true,
  orientation = 'horizontal',
  selectionMode = 'single',
  iconPosition = 'start',
  stylingMode = 'primary',
  className,
  itemRender,
}: DxTabsProps) {
  // Ensure each item has an id (auto-generate from index if not provided)
  const itemsWithIds = items?.map((item, index) => ({
    ...item,
    id: item.id ?? index,
  }));

  const handleSelectionChanged = (e: TabsTypes.SelectionChangedEvent) => {
    if (onSelectedIndexChange && e.addedItems.length > 0) {
      const selectedItem = e.addedItems[0] as DxTabItemData & { id: number };
      onSelectedIndexChange(selectedItem.id);
    }
  };

  const handleItemClick = (e: TabsTypes.ItemClickEvent) => {
    if (onItemClick) {
      onItemClick(e);
    }
  };

  // Handle both declarative (children) and programmatic (items) usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOptionChanged = (e: any) => {
    if (onOptionChanged) {
      onOptionChanged(e);
    }
  };

  // If children are provided, use declarative pattern
  if (children) {
    return (
      <Tabs
        selectedIndex={selectedIndex}
        onOptionChanged={handleOptionChanged}
        onItemClick={handleItemClick}
        width={width}
        height={height}
        showNavButtons={showNavButtons}
        scrollByContent={scrollByContent}
        orientation={orientation}
        selectionMode={selectionMode}
        iconPosition={iconPosition}
        stylingMode={stylingMode}
        className={className}
      >
        {children}
      </Tabs>
    );
  }

  // Otherwise use items array
  return (
    <Tabs
      items={itemsWithIds}
      selectedIndex={selectedIndex}
      onSelectionChanged={handleSelectionChanged}
      onItemClick={handleItemClick}
      keyExpr="id"
      width={width}
      height={height}
      showNavButtons={showNavButtons}
      scrollByContent={scrollByContent}
      orientation={orientation}
      selectionMode={selectionMode}
      iconPosition={iconPosition}
      stylingMode={stylingMode}
      className={className}
      itemRender={itemRender}
    />
  );
}
