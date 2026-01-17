'use client';

import { DateBox } from 'devextreme-react/date-box';
import { Button } from '@/components/ui/button';
import { useReportLanguage } from '@/contexts/report-language-context';

type PresetType = 'today' | 'monthEnd' | 'quarterEnd' | 'yearEnd' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'ytd';

interface AsOfDateProps {
  mode: 'asOfDate';
  asOfDate: string;
  onAsOfDateChange: (date: string) => void;
  periodStart?: never;
  periodEnd?: never;
  onPeriodStartChange?: never;
  onPeriodEndChange?: never;
}

interface PeriodRangeProps {
  mode: 'periodRange';
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (date: string) => void;
  onPeriodEndChange: (date: string) => void;
  asOfDate?: never;
  onAsOfDateChange?: never;
}

type ReportPeriodSelectorProps = (AsOfDateProps | PeriodRangeProps) & {
  showPresets?: boolean;
  onGenerate?: () => void;
  isLoading?: boolean;
};

export function ReportPeriodSelector(props: ReportPeriodSelectorProps) {
  const { t, language } = useReportLanguage();

  const presets: { label: string; labelTh: string; type: PresetType }[] = props.mode === 'asOfDate'
    ? [
        { label: 'Today', labelTh: 'วันนี้', type: 'today' },
        { label: 'Month End', labelTh: 'สิ้นเดือน', type: 'monthEnd' },
        { label: 'Quarter End', labelTh: 'สิ้นไตรมาส', type: 'quarterEnd' },
        { label: 'Year End', labelTh: 'สิ้นปี', type: 'yearEnd' },
      ]
    : [
        { label: 'This Month', labelTh: 'เดือนนี้', type: 'thisMonth' },
        { label: 'Last Month', labelTh: 'เดือนที่แล้ว', type: 'lastMonth' },
        { label: 'This Quarter', labelTh: 'ไตรมาสนี้', type: 'thisQuarter' },
        { label: 'YTD', labelTh: 'ตั้งแต่ต้นปี', type: 'ytd' },
      ];

  function applyPreset(type: PresetType) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const quarter = Math.floor(month / 3);

    if (props.mode === 'asOfDate' && props.onAsOfDateChange) {
      switch (type) {
        case 'today':
          props.onAsOfDateChange(today.toISOString().split('T')[0]);
          break;
        case 'monthEnd':
          props.onAsOfDateChange(new Date(year, month + 1, 0).toISOString().split('T')[0]);
          break;
        case 'quarterEnd':
          props.onAsOfDateChange(new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0]);
          break;
        case 'yearEnd':
          props.onAsOfDateChange(`${year}-12-31`);
          break;
      }
    } else if (props.mode === 'periodRange' && props.onPeriodStartChange && props.onPeriodEndChange) {
      switch (type) {
        case 'thisMonth':
          props.onPeriodStartChange(new Date(year, month, 1).toISOString().split('T')[0]);
          props.onPeriodEndChange(new Date(year, month + 1, 0).toISOString().split('T')[0]);
          break;
        case 'lastMonth':
          props.onPeriodStartChange(new Date(year, month - 1, 1).toISOString().split('T')[0]);
          props.onPeriodEndChange(new Date(year, month, 0).toISOString().split('T')[0]);
          break;
        case 'thisQuarter':
          props.onPeriodStartChange(new Date(year, quarter * 3, 1).toISOString().split('T')[0]);
          props.onPeriodEndChange(new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0]);
          break;
        case 'ytd':
          props.onPeriodStartChange(`${year}-01-01`);
          props.onPeriodEndChange(today.toISOString().split('T')[0]);
          break;
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
      {props.mode === 'asOfDate' ? (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">{t('asOfDate')}:</label>
          <DateBox
            data-testid="as-of-date-picker"
            value={props.asOfDate}
            onValueChanged={(e) => props.onAsOfDateChange(e.value?.toISOString().split('T')[0] || '')}
            displayFormat="dd/MM/yyyy"
            width={150}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{t('periodFrom')}:</label>
            <DateBox
              data-testid="period-start-picker"
              value={props.periodStart}
              onValueChanged={(e) => props.onPeriodStartChange(e.value?.toISOString().split('T')[0] || '')}
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{t('periodTo')}:</label>
            <DateBox
              data-testid="period-end-picker"
              value={props.periodEnd}
              onValueChanged={(e) => props.onPeriodEndChange(e.value?.toISOString().split('T')[0] || '')}
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
        </>
      )}

      {props.showPresets && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Quick:</span>
          {presets.map((preset) => (
            <button
              key={preset.type}
              onClick={() => applyPreset(preset.type)}
              className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              {language === 'th' ? preset.labelTh : preset.label}
            </button>
          ))}
        </div>
      )}

      {props.onGenerate && (
        <Button
          onClick={props.onGenerate}
          disabled={props.isLoading}
          data-testid="generate-button"
        >
          Generate Report
        </Button>
      )}
    </div>
  );
}
