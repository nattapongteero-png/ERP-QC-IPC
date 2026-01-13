/**
 * WorkflowTestConfig Component
 *
 * Configuration form for workflow test parameters.
 */

'use client'

import { memo, useState, useEffect } from 'react'
import { Settings, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TestConfiguration } from '@/types/workflow-test'
import { DEFAULT_CONFIG } from '@/types/workflow-test'

interface Props {
  config: TestConfiguration
  onConfigChange: (config: TestConfiguration) => void
  disabled?: boolean
}

interface FieldConfig {
  key: keyof TestConfiguration
  label: string
  type: 'text' | 'number'
  description: string
  phase: string
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'prefix',
    label: 'Data Prefix',
    type: 'text',
    description: 'Prefix for all test data (for cleanup identification)',
    phase: 'General',
  },
  {
    key: 'warehouseName',
    label: 'Warehouse Name',
    type: 'text',
    description: 'Name for the test warehouse',
    phase: 'Phase 1: Master Data',
  },
  {
    key: 'itemPrefix',
    label: 'Item Prefix',
    type: 'text',
    description: 'Prefix for raw material and finished goods item codes',
    phase: 'Phase 1: Master Data',
  },
  {
    key: 'vendorName',
    label: 'Vendor Name',
    type: 'text',
    description: 'Name for the test vendor',
    phase: 'Phase 3: Purchasing',
  },
  {
    key: 'purchaseQuantity',
    label: 'Purchase Quantity',
    type: 'number',
    description: 'Quantity of raw materials to purchase',
    phase: 'Phase 3: Purchasing',
  },
  {
    key: 'productionQuantity',
    label: 'Production Quantity',
    type: 'number',
    description: 'Quantity of finished goods to produce',
    phase: 'Phase 4: Production',
  },
  {
    key: 'customerName',
    label: 'Customer Name',
    type: 'text',
    description: 'Name for the test customer',
    phase: 'Phase 6: Sales',
  },
  {
    key: 'salesQuantity',
    label: 'Sales Quantity',
    type: 'number',
    description: 'Quantity of finished goods to sell',
    phase: 'Phase 6: Sales',
  },
]

// Group fields by phase
const GROUPED_FIELDS = FIELD_CONFIGS.reduce(
  (acc, field) => {
    if (!acc[field.phase]) {
      acc[field.phase] = []
    }
    acc[field.phase].push(field)
    return acc
  },
  {} as Record<string, FieldConfig[]>
)

export const WorkflowTestConfig = memo(function WorkflowTestConfig({
  config,
  onConfigChange,
  disabled = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localConfig, setLocalConfig] = useState<TestConfiguration>(config)

  // Sync local state when prop changes
  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const handleFieldChange = (key: keyof TestConfiguration, value: string | number) => {
    const newConfig = { ...localConfig, [key]: value }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const handleReset = () => {
    setLocalConfig(DEFAULT_CONFIG)
    onConfigChange(DEFAULT_CONFIG)
  }

  return (
    <div
      data-testid="workflow-test-config"
      className={cn(
        'bg-white rounded-lg shadow border border-gray-200',
        disabled && 'opacity-60 pointer-events-none'
      )}
    >
      {/* Header */}
      <button
        data-testid="config-toggle-button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full px-6 py-4 flex items-center justify-between',
          'hover:bg-gray-50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500'
        )}
      >
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-gray-400" />
          <div className="text-left">
            <h3 className="text-sm font-medium text-gray-900">Test Configuration</h3>
            <p className="text-xs text-gray-500">Customize test parameters</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div
          data-testid="config-panel"
          className="px-6 pb-6 border-t border-gray-100"
        >
          {/* Reset button */}
          <div className="flex justify-end pt-4 mb-4">
            <button
              data-testid="config-reset-button"
              onClick={handleReset}
              className={cn(
                'flex items-center gap-1.5 text-sm text-gray-600',
                'hover:text-gray-900 transition-colors'
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </button>
          </div>

          {/* Field groups */}
          <div className="space-y-6">
            {Object.entries(GROUPED_FIELDS).map(([phase, fields]) => (
              <div key={phase}>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  {phase}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label
                        htmlFor={`config-${field.key}`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {field.label}
                      </label>
                      <input
                        id={`config-${field.key}`}
                        data-testid={`config-field-${field.key}`}
                        type={field.type}
                        value={localConfig[field.key]}
                        onChange={(e) =>
                          handleFieldChange(
                            field.key,
                            field.type === 'number'
                              ? parseInt(e.target.value) || 0
                              : e.target.value
                          )
                        }
                        disabled={disabled}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border border-gray-300',
                          'text-sm text-gray-900',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                          'disabled:bg-gray-50 disabled:text-gray-500'
                        )}
                        min={field.type === 'number' ? 1 : undefined}
                      />
                      <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
