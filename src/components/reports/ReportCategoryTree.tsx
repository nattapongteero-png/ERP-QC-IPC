'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react';

export interface ReportCategory {
  id: number;
  name: string;
  description?: string | null;
  parentId?: number | null;
  sortOrder: number;
  isActive: boolean;
  reportCount?: number;
}

export interface ReportCategoryTreeProps {
  categories: ReportCategory[];
  selectedCategoryId?: number | null;
  onSelectCategory?: (categoryId: number | null) => void;
  onCreateCategory?: () => void;
  onEditCategory?: (category: ReportCategory) => void;
  onDeleteCategory?: (categoryId: number) => Promise<void>;
  isLoading?: boolean;
  showActions?: boolean;
  className?: string;
}

interface TreeNode extends ReportCategory {
  children: TreeNode[];
  level: number;
}

export function ReportCategoryTree({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  isLoading = false,
  showActions = true,
  className = '',
}: ReportCategoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Build tree structure from flat category list
  const treeData = useMemo(() => {
    const nodeMap = new Map<number, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // First pass: create all nodes
    categories.forEach((cat) => {
      nodeMap.set(cat.id, { ...cat, children: [], level: 0 });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const node = nodeMap.get(cat.id)!;
      if (cat.parentId && nodeMap.has(cat.parentId)) {
        const parent = nodeMap.get(cat.parentId)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Sort children by sortOrder
    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((node) => ({
          ...node,
          children: sortNodes(node.children),
        }));
    };

    return sortNodes(rootNodes);
  }, [categories]);

  const toggleExpand = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSelect = useCallback(
    (categoryId: number | null) => {
      onSelectCategory?.(categoryId);
    },
    [onSelectCategory]
  );

  const handleDelete = useCallback(
    async (categoryId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDeleteCategory) return;

      const confirmed = window.confirm(
        'Are you sure you want to delete this category? Reports in this category will become uncategorized.'
      );
      if (!confirmed) return;

      setDeletingId(categoryId);
      try {
        await onDeleteCategory(categoryId);
      } catch (error) {
        console.error('Delete category error:', error);
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleteCategory]
  );

  const renderNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedCategoryId === node.id;
    const hasChildren = node.children.length > 0;
    const isDeleting = deletingId === node.id;
    const isHovered = hoveredId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          style={{ paddingLeft: `${8 + node.level * 16}px` }}
          onClick={() => handleSelect(node.id)}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Expand/Collapse Toggle */}
          <button
            onClick={(e) => toggleExpand(node.id, e)}
            className={`p-0.5 hover:bg-gray-200 rounded ${
              !hasChildren ? 'invisible' : ''
            }`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Folder Icon */}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-gray-500 flex-shrink-0" />
          )}

          {/* Category Name */}
          <span className="flex-1 truncate text-sm">{node.name}</span>

          {/* Report Count */}
          {node.reportCount !== undefined && node.reportCount > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {node.reportCount}
            </span>
          )}

          {/* Action Buttons */}
          {showActions && isHovered && !isDeleting && (
            <div className="flex items-center gap-1">
              {onEditCategory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory(node);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Edit Category"
                >
                  <Edit className="h-3 w-3 text-gray-500" />
                </button>
              )}
              {onDeleteCategory && (
                <button
                  onClick={(e) => handleDelete(node.id, e)}
                  className="p-1 hover:bg-red-100 rounded"
                  title="Delete Category"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              )}
            </div>
          )}

          {isDeleting && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderNode(child))}</div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Categories</h3>
        {showActions && onCreateCategory && (
          <button
            onClick={onCreateCategory}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add Category"
          >
            <Plus className="h-4 w-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Tree Content */}
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Folder className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No categories yet
          </div>
        ) : (
          <>
            {/* All Reports Option */}
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                selectedCategoryId === null
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              onClick={() => handleSelect(null)}
            >
              <div className="p-0.5 invisible">
                <ChevronRight className="h-4 w-4" />
              </div>
              <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium">All Reports</span>
            </div>

            {/* Category Tree */}
            {treeData.map((node) => renderNode(node))}
          </>
        )}
      </div>
    </div>
  );
}

export default ReportCategoryTree;
