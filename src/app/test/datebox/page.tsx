"use client";

import { useState, useEffect } from 'react';
import { DxDateBox } from '@/components/ui/dx-date-box';

/**
 * E2E Test Page for DxDateBox with Buddhist Era Date Formatting
 *
 * This page tests:
 * 1. Buddhist Era date display (Gregorian + 543)
 * 2. Date picker interaction
 * 3. Various date types (date, datetime, time)
 * 4. Validation (required, min/max)
 * 5. Form integration
 */
export default function DateBoxTestPage() {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development');
  }, []);

  if (!isDev) {
    return <div className="p-8 text-center">This page is only available in development mode.</div>;
  }

  return <DateBoxTestContent />;
}

function DateBoxTestContent() {
  // Basic date states
  const [basicDate, setBasicDate] = useState<string>('');
  const [prefilledDate, setPrefilledDate] = useState<string>('2025-12-21');
  const [dateTime, setDateTime] = useState<string>('');
  const [timeOnly, setTimeOnly] = useState<string>('');

  // Validation states
  const [requiredDate, setRequiredDate] = useState<string>('');
  const [rangeDate, setRangeDate] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" data-testid="page-title">
        DxDateBox E2E Test - Buddhist Era Formatting
      </h1>

      {/* Section 1: Basic Date Picker */}
      <section className="mb-8 p-4 border rounded-lg" data-testid="section-basic">
        <h2 className="text-lg font-semibold mb-4">1. Basic Date Picker</h2>

        <div className="space-y-4">
          <div>
            <DxDateBox
              label="Empty Date"
              value={basicDate}
              onValueChange={setBasicDate}
              showClearButton
              data-testid="basic-date"
            />
            <p className="mt-1 text-sm text-gray-600" data-testid="basic-date-value">
              ISO Value: {basicDate || '(empty)'}
            </p>
          </div>

          <div>
            <DxDateBox
              label="Pre-filled Date (21 Dec 2025 = 21/12/2568)"
              value={prefilledDate}
              onValueChange={setPrefilledDate}
              showClearButton
              data-testid="prefilled-date"
            />
            <p className="mt-1 text-sm text-gray-600" data-testid="prefilled-date-value">
              ISO Value: {prefilledDate || '(empty)'}
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Date Types */}
      <section className="mb-8 p-4 border rounded-lg" data-testid="section-types">
        <h2 className="text-lg font-semibold mb-4">2. Date Types</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <DxDateBox
              label="Date Only"
              type="date"
              value={basicDate}
              onValueChange={setBasicDate}
              data-testid="type-date"
            />
            <p className="mt-1 text-sm text-gray-600">Format: DD/MM/YYYY+543</p>
          </div>

          <div>
            <DxDateBox
              label="Date & Time"
              type="datetime"
              value={dateTime}
              onValueChange={setDateTime}
              data-testid="type-datetime"
            />
            <p className="mt-1 text-sm text-gray-600" data-testid="datetime-value">
              Value: {dateTime || '(empty)'}
            </p>
          </div>

          <div>
            <DxDateBox
              label="Time Only"
              type="time"
              value={timeOnly}
              onValueChange={setTimeOnly}
              data-testid="type-time"
            />
            <p className="mt-1 text-sm text-gray-600" data-testid="time-value">
              Value: {timeOnly || '(empty)'}
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Validation */}
      <section className="mb-8 p-4 border rounded-lg" data-testid="section-validation">
        <h2 className="text-lg font-semibold mb-4">3. Validation</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <DxDateBox
              label="Required Date"
              value={requiredDate}
              onValueChange={setRequiredDate}
              required
              requiredMessage="Please select a date"
              validationGroup="test-validation"
              data-testid="required-date"
            />
          </div>

          <div>
            <DxDateBox
              label="Date Range (2025-01-01 to 2025-12-31)"
              value={rangeDate}
              onValueChange={setRangeDate}
              min="2025-01-01"
              max="2025-12-31"
              validationGroup="test-validation"
              data-testid="range-date"
            />
            <p className="mt-1 text-sm text-gray-600" data-testid="range-date-value">
              Value: {rangeDate || '(empty)'}
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: States */}
      <section className="mb-8 p-4 border rounded-lg" data-testid="section-states">
        <h2 className="text-lg font-semibold mb-4">4. Component States</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <DxDateBox
              label="Disabled"
              value="2025-06-15"
              disabled
              data-testid="disabled-date"
            />
          </div>

          <div>
            <DxDateBox
              label="Read Only"
              value="2025-06-15"
              readOnly
              data-testid="readonly-date"
            />
          </div>

          <div>
            <DxDateBox
              label="With Clear Button"
              value={basicDate}
              onValueChange={setBasicDate}
              showClearButton
              data-testid="clearable-date"
            />
          </div>
        </div>
      </section>

      {/* Section 5: Form Integration */}
      <section className="mb-8 p-4 border rounded-lg" data-testid="section-form">
        <h2 className="text-lg font-semibold mb-4">5. Form Integration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DxDateBox
            label="Start Date"
            value={formData.startDate}
            onValueChange={(v) => setFormData(prev => ({ ...prev, startDate: v }))}
            name="startDate"
            data-testid="form-start-date"
          />

          <DxDateBox
            label="End Date"
            value={formData.endDate}
            onValueChange={(v) => setFormData(prev => ({ ...prev, endDate: v }))}
            name="endDate"
            min={formData.startDate || undefined}
            data-testid="form-end-date"
          />
        </div>

        <div className="mt-4 p-3 bg-gray-100 rounded" data-testid="form-output">
          <p className="font-mono text-sm">
            Form Data: {JSON.stringify(formData)}
          </p>
        </div>
      </section>

      {/* Section 6: Buddhist Era Conversion Reference */}
      <section className="mb-8 p-4 border rounded-lg bg-blue-50" data-testid="section-reference">
        <h2 className="text-lg font-semibold mb-4">6. Buddhist Era Reference</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Gregorian (ISO)</th>
              <th className="text-left py-2">Buddhist Era Display</th>
              <th className="text-left py-2">Calculation</th>
            </tr>
          </thead>
          <tbody data-testid="reference-table">
            <tr className="border-b">
              <td className="py-2">2025-12-21</td>
              <td className="py-2">21/12/2568</td>
              <td className="py-2">2025 + 543 = 2568</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">2024-01-01</td>
              <td className="py-2">01/01/2567</td>
              <td className="py-2">2024 + 543 = 2567</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">2000-06-15</td>
              <td className="py-2">15/06/2543</td>
              <td className="py-2">2000 + 543 = 2543</td>
            </tr>
            <tr>
              <td className="py-2">1990-03-10</td>
              <td className="py-2">10/03/2533</td>
              <td className="py-2">1990 + 543 = 2533</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
