'use client';

import * as React from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { toLocalDateStr } from '@/lib/utils/date-format';

interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  helperText?: string;
  error?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  showQuickActions?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Thai month names
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Convert Gregorian year to Buddhist year
const toBuddhistYear = (year: number): number => year + 543;
const toGregorianYear = (buddhistYear: number): number => buddhistYear - 543;

const formatDisplayDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDate();
    const month = THAI_MONTHS_SHORT[date.getMonth()];
    const year = toBuddhistYear(date.getFullYear());
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
};

const formatRelativeDate = (dateStr: string | undefined): string | null => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'วันนี้';
    if (diffDays === 1) return 'พรุ่งนี้';
    if (diffDays === -1) return 'เมื่อวาน';
    if (diffDays > 1 && diffDays <= 7) return `อีก ${diffDays} วัน`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} วันที่แล้ว`;
    return null;
  } catch {
    return null;
  }
};

const getDateStatus = (dateStr: string | undefined): { color: string; bgColor: string } | null => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'text-red-600', bgColor: 'bg-red-50' };
    if (diffDays === 0) return { color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (diffDays <= 7) return { color: 'text-amber-600', bgColor: 'bg-amber-50' };
    return { color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
  } catch {
    return null;
  }
};

const sizeStyles = {
  sm: { container: 'h-9', text: 'text-sm', icon: 'h-4 w-4', padding: 'px-3 py-1.5', label: 'text-xs' },
  md: { container: 'h-10', text: 'text-sm', icon: 'h-4 w-4', padding: 'px-3 py-2', label: 'text-sm' },
  lg: { container: 'h-12', text: 'text-base', icon: 'h-5 w-5', padding: 'px-4 py-3', label: 'text-sm' },
};

// Calendar Popup Component
interface CalendarPopupProps {
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
  minDate?: Date | null;
  maxDate?: Date | null;
}

const CalendarPopup: React.FC<CalendarPopupProps> = ({
  selectedDate,
  onSelect,
  onClose,
  minDate,
  maxDate,
}) => {
  const [viewDate, setViewDate] = React.useState(() => {
    return selectedDate || new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const buddhistYear = toBuddhistYear(year);

  // Get first day of month and total days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Navigate months
  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const prevYear = () => {
    setViewDate(new Date(year - 1, month, 1));
  };

  const nextYear = () => {
    setViewDate(new Date(year + 1, month, 1));
  };

  // Check if date is selectable
  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Check if date is selected
  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  // Generate calendar days
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month days to fill grid
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  // Quick select today
  const selectToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isDateDisabled(today)) {
      onSelect(today);
    }
  };

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-[320px]">
      {/* Header with year and month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevYear}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="ปีก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
            <ChevronLeft className="h-4 w-4 -ml-3" />
          </button>
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center">
          <div className="font-semibold text-gray-900">
            {THAI_MONTHS[month]}
          </div>
          <div className="text-sm text-emerald-600 font-medium">
            พ.ศ. {buddhistYear}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="เดือนถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextYear}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="ปีถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 -ml-3" />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {THAI_DAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-medium py-1',
              i === 0 ? 'text-red-500' : 'text-gray-500'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, isCurrentMonth }, index) => {
          const disabled = isDateDisabled(date);
          const today = isToday(date);
          const selected = isSelected(date);
          const isSunday = date.getDay() === 0;

          return (
            <button
              key={index}
              type="button"
              onClick={() => !disabled && onSelect(date)}
              disabled={disabled}
              className={cn(
                'h-9 w-9 rounded-lg text-sm font-medium transition-all',
                !isCurrentMonth && 'text-gray-300',
                isCurrentMonth && !disabled && !selected && 'text-gray-700 hover:bg-emerald-50',
                isCurrentMonth && isSunday && !selected && 'text-red-500',
                today && !selected && 'ring-2 ring-emerald-500 ring-offset-1',
                selected && 'bg-emerald-600 text-white hover:bg-emerald-700',
                disabled && 'text-gray-300 cursor-not-allowed hover:bg-transparent'
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <button
          type="button"
          onClick={selectToday}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          วันนี้
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
        >
          ปิด
        </button>
      </div>
    </div>
  );
};

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      helperText,
      error,
      min,
      max,
      placeholder = 'เลือกวันที่...',
      disabled = false,
      required = false,
      className,
      showQuickActions = true,
      size = 'md',
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const styles = sizeStyles[size];

    // Parse value to Date
    const selectedDate = React.useMemo(() => {
      if (!value) return null;
      const date = new Date(value + 'T00:00:00');
      return isNaN(date.getTime()) ? null : date;
    }, [value]);

    // Parse min/max dates
    const minDate = React.useMemo(() => {
      if (!min) return null;
      const date = new Date(min + 'T00:00:00');
      return isNaN(date.getTime()) ? null : date;
    }, [min]);

    const maxDate = React.useMemo(() => {
      if (!max) return null;
      const date = new Date(max + 'T00:00:00');
      return isNaN(date.getTime()) ? null : date;
    }, [max]);

    // Handle date selection
    const handleSelect = (date: Date) => {
      const isoDate = toLocalDateStr(date);
      onChange?.(isoDate);
      setIsOpen(false);
    };

    // Handle clear
    const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange?.('');
    };

    // Quick actions
    const handleToday = (e: React.MouseEvent) => {
      e.preventDefault();
      const today = toLocalDateStr(new Date());
      onChange?.(today);
    };

    const handleTomorrow = (e: React.MouseEvent) => {
      e.preventDefault();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      onChange?.(toLocalDateStr(tomorrow));
    };

    const handleNextWeek = (e: React.MouseEvent) => {
      e.preventDefault();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      onChange?.(toLocalDateStr(nextWeek));
    };

    // Close on outside click
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    const displayDate = formatDisplayDate(value);
    const relativeDate = formatRelativeDate(value);
    const dateStatus = getDateStatus(value);

    return (
      <div ref={containerRef} className={cn('w-full relative', className)}>
        {label && (
          <label className={cn('block font-medium text-gray-700 mb-1.5', styles.label)}>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Hidden input for form compatibility */}
        <input
          ref={ref}
          type="hidden"
          value={value || ''}
          required={required}
        />

        {/* Custom styled display */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsOpen(!isOpen);
            }
          }}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg border bg-white transition-all cursor-pointer',
            styles.container,
            styles.padding,
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-gray-300 hover:border-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
            disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
            isOpen && 'border-emerald-500 ring-2 ring-emerald-500/20'
          )}
        >
          {/* Calendar Icon */}
          <Calendar
            className={cn(
              styles.icon,
              value ? (dateStatus?.color || 'text-emerald-600') : 'text-gray-400'
            )}
          />

          {/* Date Display */}
          <div className="flex-1 text-left min-w-0">
            {value ? (
              <div className="flex items-center gap-2">
                <span className={cn('font-medium text-gray-900', styles.text)}>
                  {displayDate}
                </span>
                {relativeDate && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded', dateStatus?.bgColor, dateStatus?.color)}>
                    {relativeDate}
                  </span>
                )}
              </div>
            ) : (
              <span className={cn('text-gray-400', styles.text)}>{placeholder}</span>
            )}
          </div>

          {/* Clear button */}
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              tabIndex={-1}
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Calendar Popup */}
        {isOpen && !disabled && (
          <CalendarPopup
            selectedDate={selectedDate}
            onSelect={handleSelect}
            onClose={() => setIsOpen(false)}
            minDate={minDate}
            maxDate={maxDate}
          />
        )}

        {/* Quick Action Buttons */}
        {showQuickActions && !disabled && (
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={handleToday}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                value === toLocalDateStr(new Date())
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={handleTomorrow}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              พรุ่งนี้
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              +7 วัน
            </button>
          </div>
        )}

        {/* Helper Text or Error */}
        {(error || helperText) && (
          <p className={cn('mt-1.5 text-sm', error ? 'text-red-600' : 'text-gray-500')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

// Date Range Picker Component
interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  label?: string;
  startLabel?: string;
  endLabel?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label,
  startLabel = 'จาก',
  endLabel = 'ถึง',
  helperText,
  error,
  disabled = false,
  className,
  size = 'md',
}) => {
  const handleThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    onStartDateChange?.(toLocalDateStr(startOfWeek));
    onEndDateChange?.(toLocalDateStr(endOfWeek));
  };

  const handleThisMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    onStartDateChange?.(toLocalDateStr(startOfMonth));
    onEndDateChange?.(toLocalDateStr(endOfMonth));
  };

  const handleLast30Days = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    onStartDateChange?.(toLocalDateStr(thirtyDaysAgo));
    onEndDateChange?.(toLocalDateStr(today));
  };

  const handleLast90Days = () => {
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);

    onStartDateChange?.(toLocalDateStr(ninetyDaysAgo));
    onEndDateChange?.(toLocalDateStr(today));
  };

  const handleClear = () => {
    onStartDateChange?.('');
    onEndDateChange?.('');
  };

  // Calculate duration
  const getDuration = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays === 1) return '1 วัน';
    if (diffDays < 7) return `${diffDays} วัน`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} สัปดาห์ (${diffDays} วัน)`;
    return `${Math.ceil(diffDays / 30)} เดือน (${diffDays} วัน)`;
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      )}

      {/* Quick Range Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-500">ช่วงเวลา:</span>
        <button
          type="button"
          onClick={handleThisWeek}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          สัปดาห์นี้
        </button>
        <button
          type="button"
          onClick={handleThisMonth}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          เดือนนี้
        </button>
        <button
          type="button"
          onClick={handleLast30Days}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          30 วันล่าสุด
        </button>
        <button
          type="button"
          onClick={handleLast90Days}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          90 วันล่าสุด
        </button>
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            ล้าง
          </button>
        )}
      </div>

      {/* Date Range Inputs */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <DatePicker
            value={startDate}
            onChange={onStartDateChange}
            label={startLabel}
            max={endDate}
            disabled={disabled}
            showQuickActions={false}
            size={size}
          />
        </div>
        <div className="flex items-center justify-center pb-2">
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <DatePicker
            value={endDate}
            onChange={onEndDateChange}
            label={endLabel}
            min={startDate}
            disabled={disabled}
            showQuickActions={false}
            size={size}
          />
        </div>
      </div>

      {/* Duration Display */}
      {getDuration() && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{getDuration()}</span>
        </div>
      )}

      {/* Helper Text or Error */}
      {(error || helperText) && (
        <p className={cn('mt-1.5 text-sm', error ? 'text-red-600' : 'text-gray-500')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export { DatePicker, DateRangePicker };
