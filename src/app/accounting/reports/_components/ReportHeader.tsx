'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReportLanguage } from '@/contexts/report-language-context';

export interface ReportHeaderProps {
  titleKey: string;
  subtitle?: string;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function ReportHeader({ titleKey, subtitle, onRefresh, isLoading }: ReportHeaderProps) {
  const { language, setLanguage, t } = useReportLanguage();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Language Toggle */}
        <button
          data-testid="language-toggle"
          onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <span className={`text-sm font-medium ${language === 'th' ? 'text-blue-600' : 'text-gray-500'}`}>
            TH
          </span>
          <span className="text-gray-300">|</span>
          <span className={`text-sm font-medium ${language === 'en' ? 'text-blue-600' : 'text-gray-500'}`}>
            EN
          </span>
        </button>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          data-testid="refresh-button"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>
    </div>
  );
}
