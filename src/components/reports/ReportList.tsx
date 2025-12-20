'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DxButton } from '@/components/ui/dx-button';
import {
  FileText,
  Eye,
  Edit,
  Trash2,
  Globe,
  GlobeLock,
  Search,
  Filter,
  MoreVertical,
  Loader2,
} from 'lucide-react';

export interface ReportTemplate {
  id: number;
  name: string;
  description?: string | null;
  code: string;
  categoryId?: number | null;
  categoryName?: string | null;
  version: number;
  isPublished: boolean;
  isSystem: boolean;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportListProps {
  templates: ReportTemplate[];
  isLoading?: boolean;
  selectedCategoryId?: number | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onCategoryFilter?: (categoryId: number | null) => void;
  onPublishToggle?: (code: string, publish: boolean) => Promise<void>;
  onDelete?: (code: string) => Promise<void>;
  onRefresh?: () => void;
  showActions?: boolean;
  className?: string;
}

export function ReportList({
  templates,
  isLoading = false,
  selectedCategoryId,
  searchQuery = '',
  onSearchChange,
  onPublishToggle,
  onDelete,
  onRefresh,
  showActions = true,
  className = '',
}: ReportListProps) {
  const router = useRouter();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [publishingCode, setPublishingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Filter templates locally if search is provided
  const filteredTemplates = useMemo(() => {
    if (!localSearch) return templates;
    const lowerSearch = localSearch.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.description?.toLowerCase().includes(lowerSearch) ||
        t.code.toLowerCase().includes(lowerSearch)
    );
  }, [templates, localSearch]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );

  const handleView = useCallback(
    (code: string) => {
      router.push(`/reports/view/${code}`);
    },
    [router]
  );

  const handleEdit = useCallback(
    (code: string) => {
      router.push(`/reports/design/${code}`);
    },
    [router]
  );

  const handlePublishToggle = useCallback(
    async (code: string, currentlyPublished: boolean) => {
      if (!onPublishToggle) return;

      setPublishingCode(code);
      setActiveMenu(null);
      try {
        await onPublishToggle(code, !currentlyPublished);
        onRefresh?.();
      } catch (error) {
        console.error('Publish toggle error:', error);
      } finally {
        setPublishingCode(null);
      }
    },
    [onPublishToggle, onRefresh]
  );

  const handleDelete = useCallback(
    async (code: string) => {
      if (!onDelete) return;

      const confirmed = window.confirm(
        'Are you sure you want to delete this report template? This action cannot be undone.'
      );
      if (!confirmed) return;

      setDeletingCode(code);
      setActiveMenu(null);
      try {
        await onDelete(code);
        onRefresh?.();
      } catch (error) {
        console.error('Delete error:', error);
      } finally {
        setDeletingCode(null);
      }
    },
    [onDelete, onRefresh]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports..."
            value={localSearch}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {onRefresh && (
          <DxButton
            text="Refresh"
            icon="refresh"
            type="normal"
            stylingMode="outlined"
            onClick={onRefresh}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading reports...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
          <p className="text-gray-500 mb-4">
            {localSearch
              ? 'Try adjusting your search terms'
              : selectedCategoryId
                ? 'No reports in this category'
                : 'Get started by creating a new report'}
          </p>
          {!localSearch && !selectedCategoryId && (
            <DxButton
              text="Create Report"
              icon="add"
              type="default"
              onClick={() => router.push('/reports/new')}
            />
          )}
        </div>
      )}

      {/* Report List */}
      {!isLoading && filteredTemplates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  Report Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 hidden md:table-cell">
                  Category
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700 hidden lg:table-cell">
                  Version
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 hidden lg:table-cell">
                  Updated
                </th>
                {showActions && (
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {template.name}
                        </div>
                        {template.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {template.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 font-mono">
                          {template.code}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600">
                      {template.categoryName || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm">
                      v{template.version}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {publishingCode === template.code ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-600" />
                    ) : template.isPublished ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-sm">
                        <Globe className="h-3 w-3" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-sm">
                        <GlobeLock className="h-3 w-3" />
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-600">
                      {formatDate(template.updatedAt)}
                    </span>
                  </td>
                  {showActions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(template.code)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Report"
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleEdit(template.code)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit Report"
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenu(
                                activeMenu === template.code ? null : template.code
                              )
                            }
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="More Actions"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </button>
                          {activeMenu === template.code && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                              <button
                                onClick={() =>
                                  handlePublishToggle(
                                    template.code,
                                    template.isPublished
                                  )
                                }
                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                              >
                                {template.isPublished ? (
                                  <>
                                    <GlobeLock className="h-4 w-4" />
                                    Unpublish
                                  </>
                                ) : (
                                  <>
                                    <Globe className="h-4 w-4" />
                                    Publish
                                  </>
                                )}
                              </button>
                              {!template.isSystem && (
                                <button
                                  onClick={() => handleDelete(template.code)}
                                  disabled={deletingCode === template.code}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                  {deletingCode === template.code ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {!isLoading && filteredTemplates.length > 0 && (
        <div className="text-sm text-gray-500">
          Showing {filteredTemplates.length} report
          {filteredTemplates.length !== 1 ? 's' : ''}
          {localSearch && ` matching "${localSearch}"`}
        </div>
      )}
    </div>
  );
}

export default ReportList;
