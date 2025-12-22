'use client';

/**
 * TrendChart Component
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * A reusable trend/line chart component using DevExtreme dxChart.
 * Supports multiple series, specification limits, and trend projections.
 * Used for stability trending, CAPA metrics, compliance rates, etc.
 */

import React, { useMemo } from 'react';
import {
  Chart,
  CommonSeriesSettings,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Tooltip,
  ConstantLine,
  Title,
  Point,
  Export,
  ZoomAndPan,
} from 'devextreme-react/chart';

export interface TrendDataPoint {
  /** X-axis value (date, timepoint, or category) */
  argument: string | number | Date;
  /** Y-axis value */
  value: number;
  /** Optional label for this point */
  label?: string;
}

export interface TrendSeries {
  /** Unique identifier for this series */
  name: string;
  /** Display name for legend */
  displayName?: string;
  /** Data points for this series */
  data: TrendDataPoint[];
  /** Color for this series */
  color?: string;
  /** Line style - matches DevExtreme DashStyle */
  dashStyle?: 'dash' | 'dot' | 'longDash' | 'solid';
  /** Whether to show data points */
  showPoints?: boolean;
  /** Point symbol */
  pointSymbol?: 'circle' | 'square' | 'polygon' | 'triangle' | 'cross';
}

export interface SpecificationLimit {
  /** Value for the limit line */
  value: number;
  /** Display label */
  label: string;
  /** Color for the line */
  color?: string;
  /** Line style - matches DevExtreme DashStyle */
  dashStyle?: 'dash' | 'dot' | 'longDash' | 'solid';
  /** Position of label */
  labelPosition?: 'left' | 'right' | 'inside';
}

export interface TrendChartProps {
  /** Chart title */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Array of data series to plot */
  series: TrendSeries[];
  /** X-axis label */
  argumentAxisTitle?: string;
  /** Y-axis label */
  valueAxisTitle?: string;
  /** Upper specification limit */
  upperLimit?: SpecificationLimit;
  /** Lower specification limit */
  lowerLimit?: SpecificationLimit;
  /** Target/center line */
  targetLine?: SpecificationLimit;
  /** Height of the chart */
  height?: number | string;
  /** Show export button */
  showExport?: boolean;
  /** Enable zoom and pan */
  enableZoom?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Chart type */
  chartType?: 'line' | 'spline' | 'area' | 'splinearea' | 'scatter';
  /** Additional CSS classes */
  className?: string;
}

export function TrendChart({
  title,
  subtitle,
  series,
  argumentAxisTitle,
  valueAxisTitle,
  upperLimit,
  lowerLimit,
  targetLine,
  height = 400,
  showExport = false,
  enableZoom = false,
  isLoading = false,
  chartType = 'line',
  className = '',
}: TrendChartProps) {
  // Prepare data for the chart
  const chartData = useMemo(() => {
    // Combine all series data into a single array with series-specific value keys
    const dataMap = new Map<string | number, Record<string, number | string | Date>>();

    series.forEach((s) => {
      s.data.forEach((point) => {
        const key = String(point.argument);
        if (!dataMap.has(key)) {
          dataMap.set(key, { argument: point.argument });
        }
        const entry = dataMap.get(key)!;
        entry[s.name] = point.value;
      });
    });

    return Array.from(dataMap.values());
  }, [series]);

  const customizeTooltip = (pointInfo: { seriesName: string; argumentText: string; valueText: string }) => {
    const seriesConfig = series.find((s) => s.name === pointInfo.seriesName);
    const displayName = seriesConfig?.displayName || pointInfo.seriesName;

    return {
      text: `${displayName}\n${pointInfo.argumentText}: ${pointInfo.valueText}`,
    };
  };

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (series.length === 0 || chartData.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Chart
        id="trend-chart"
        dataSource={chartData}
        height={height}
      >
        {title && (
          <Title text={title} subtitle={subtitle ? { text: subtitle } : undefined} />
        )}

        <CommonSeriesSettings
          type={chartType}
          argumentField="argument"
        >
          <Point visible={true} size={8} />
        </CommonSeriesSettings>

        {series.map((s) => (
          <Series
            key={s.name}
            valueField={s.name}
            name={s.displayName || s.name}
            color={s.color}
            dashStyle={s.dashStyle}
          >
            <Point
              visible={s.showPoints !== false}
              symbol={s.pointSymbol || 'circle'}
            />
          </Series>
        ))}

        <ArgumentAxis title={argumentAxisTitle}>
          {/* Argument axis configuration */}
        </ArgumentAxis>

        <ValueAxis title={valueAxisTitle}>
          {upperLimit && (
            <ConstantLine
              value={upperLimit.value}
              color={upperLimit.color || '#dc2626'}
              dashStyle={upperLimit.dashStyle || 'dash'}
              width={2}
              label={{
                text: upperLimit.label,
                position: upperLimit.labelPosition || 'right',
                font: { color: upperLimit.color || '#dc2626' },
              }}
            />
          )}

          {lowerLimit && (
            <ConstantLine
              value={lowerLimit.value}
              color={lowerLimit.color || '#dc2626'}
              dashStyle={lowerLimit.dashStyle || 'dash'}
              width={2}
              label={{
                text: lowerLimit.label,
                position: lowerLimit.labelPosition || 'right',
                font: { color: lowerLimit.color || '#dc2626' },
              }}
            />
          )}

          {targetLine && (
            <ConstantLine
              value={targetLine.value}
              color={targetLine.color || '#16a34a'}
              dashStyle={targetLine.dashStyle || 'solid'}
              width={2}
              label={{
                text: targetLine.label,
                position: targetLine.labelPosition || 'right',
                font: { color: targetLine.color || '#16a34a' },
              }}
            />
          )}
        </ValueAxis>

        <Legend
          visible={series.length > 1}
          verticalAlignment="bottom"
          horizontalAlignment="center"
          itemTextPosition="right"
          orientation="horizontal"
        />

        <Tooltip
          enabled={true}
          customizeTooltip={customizeTooltip}
          shared={false}
        />

        {showExport && <Export enabled={true} />}

        {enableZoom && (
          <ZoomAndPan
            argumentAxis="both"
            valueAxis="zoom"
            allowMouseWheel={true}
            allowTouchGestures={true}
          />
        )}
      </Chart>
    </div>
  );
}

export default TrendChart;
