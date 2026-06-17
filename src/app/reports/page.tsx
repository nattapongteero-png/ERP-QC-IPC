'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { ReportList, type ReportTemplate } from '@/components/reports/ReportList';
import { ReportCategoryTree, type ReportCategory } from '@/components/reports/ReportCategoryTree';
import { FileText, AlertCircle, Settings } from 'lucide-react';

interface TemplatesResponse {
  success: boolean;
  data?: ReportTemplate[];
  error?: string;
}

interface CategoriesResponse {
  success: boolean;
  data?: ReportCategory[];
  error?: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const t = useTranslations('reports');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedCategoryId) {
        params.set('categoryId', selectedCategoryId.toString());
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const url = `/api/reports/templates${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);
      const data: TemplatesResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch templates');
      }

      setTemplates(data.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      console.error('Templates fetch error:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [selectedCategoryId, searchQuery]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setIsLoadingCategories(true);

      const response = await fetch('/api/reports/categories');
      const data: CategoriesResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      setCategories(data.data || []);
    } catch (err) {
      console.error('Categories fetch error:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handlePublishToggle = useCallback(async (code: string, publish: boolean) => {
    const response = await fetch(`/api/reports/templates/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: publish }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to update publish status');
    }
  }, []);

  const handleDelete = useCallback(async (code: string) => {
    const response = await fetch(`/api/reports/templates/${code}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete template');
    }
  }, []);

  const handleCategorySelect = useCallback((categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const handleCreateReport = () => {
    router.push('/reports/new');
  };

  // Create a report category via a lightweight name prompt, then refresh the
  // tree. Keeps the feature usable without a full modal build-out.
  const handleCreateCategory = useCallback(async () => {
    const name = window.prompt(t('category.createPrompt'));
    if (!name || !name.trim()) return;
    try {
      const response = await fetch('/api/reports/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || t('category.createFailed'));
      }
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('category.createFailed'));
    }
  }, [t, fetchCategories]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 p-4 md:p-0">
        <ResponsivePageHeader
          title={t('page.title')}
          subtitle={t('page.description')}
          icon={FileText}
          iconBgColor="bg-indigo-100"
          iconColor="text-indigo-600"
          actions={
            <DxButton
              text={t('actions.newReport')}
              icon="add"
              type="default"
              onClick={handleCreateReport}
            />
          }
        />

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              {t('actions.dismiss')}
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Category Sidebar */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <ReportCategoryTree
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleCategorySelect}
              onCreateCategory={handleCreateCategory}
              isLoading={isLoadingCategories}
              showActions={true}
            />

            {/* Quick Stats */}
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('overview.title')}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('overview.totalTemplates')}</span>
                  <span className="font-medium text-gray-900">{templates.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('overview.published')}</span>
                  <span className="font-medium text-green-600">
                    {templates.filter(tmpl => tmpl.isPublished).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('overview.drafts')}</span>
                  <span className="font-medium text-yellow-600">
                    {templates.filter(tmpl => !tmpl.isPublished).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('overview.categories')}</span>
                  <span className="font-medium text-gray-900">{categories.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Report List */}
          <div className="flex-1 min-w-0">
            <ReportList
              templates={templates}
              isLoading={isLoadingTemplates}
              selectedCategoryId={selectedCategoryId}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onPublishToggle={handlePublishToggle}
              onDelete={handleDelete}
              onRefresh={fetchTemplates}
              showActions={true}
            />
          </div>
        </div>

        {/* Mobile Category Filter */}
        <div className="lg:hidden">
          <details className="bg-white border border-gray-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-sm font-medium text-gray-700">
              <Settings className="h-4 w-4" />
              {t('mobile.filterByCategory')}
              {selectedCategoryId && (
                <span className="ml-auto text-blue-600">
                  {categories.find(c => c.id === selectedCategoryId)?.name || t('mobile.selected')}
                </span>
              )}
            </summary>
            <div className="px-4 pb-4">
              <ReportCategoryTree
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={handleCategorySelect}
                isLoading={isLoadingCategories}
                showActions={false}
              />
            </div>
          </details>
        </div>
      </div>
    </MainLayout>
  );
}
