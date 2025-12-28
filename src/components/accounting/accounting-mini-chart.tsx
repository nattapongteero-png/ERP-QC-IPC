'use client';

import React from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area } from 'recharts';

export interface AccountingMiniChartProps {
  data: Array<{ value: number; [key: string]: unknown }>;
  type?: 'line' | 'bar' | 'area';
  color?: string;
  height?: number;
  className?: string;
}

export function AccountingMiniChart({
  data,
  type = 'line',
  color = '#3b82f6',
  height = 40,
  className = '',
}: AccountingMiniChartProps) {
  return (
    <div data-testid="mini-chart" className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' && (
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        )}
        {type === 'bar' && (
          <BarChart data={data}>
            <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        )}
        {type === 'area' && (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} fill={`url(#gradient-${color})`} strokeWidth={2} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
