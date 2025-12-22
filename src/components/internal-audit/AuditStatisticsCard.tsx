'use client';

/**
 * Audit Statistics Card Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Displays audit statistics and trends.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { AuditStatistics, ChapterCoverage } from '@/types/audits';

interface AuditStatisticsCardProps {
  statistics: AuditStatistics | null;
  chapterCoverage: ChapterCoverage | null;
  loading?: boolean;
}

const CATEGORY_COLORS = {
  observation: '#3b82f6', // blue
  minor: '#eab308', // yellow
  major: '#f97316', // orange
  critical: '#ef4444', // red
};

export function AuditStatisticsCard({
  statistics,
  chapterCoverage,
  loading = false,
}: AuditStatisticsCardProps) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No statistics available
      </div>
    );
  }

  const findingsData = [
    { name: 'Observation', value: statistics.findingsByCategory.observation, fill: CATEGORY_COLORS.observation },
    { name: 'Minor', value: statistics.findingsByCategory.minor, fill: CATEGORY_COLORS.minor },
    { name: 'Major', value: statistics.findingsByCategory.major, fill: CATEGORY_COLORS.major },
    { name: 'Critical', value: statistics.findingsByCategory.critical, fill: CATEGORY_COLORS.critical },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-2xl font-bold">{statistics.totalPlanned}</p>
          <p className="text-sm text-muted-foreground">Audits Planned</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-2xl font-bold text-green-600">{statistics.totalCompleted}</p>
          <p className="text-sm text-muted-foreground">Audits Completed</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-2xl font-bold">{statistics.totalFindings}</p>
          <p className="text-sm text-muted-foreground">Total Findings</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className={`text-2xl font-bold ${statistics.openFindings > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {statistics.openFindings}
          </p>
          <p className="text-sm text-muted-foreground">Open Findings</p>
        </div>
      </div>

      {/* Completion Rate */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Audit Completion Rate</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-muted rounded-full h-4">
            <div
              className="bg-green-600 h-4 rounded-full"
              style={{ width: `${statistics.completionRate}%` }}
            />
          </div>
          <span className="text-lg font-bold">{statistics.completionRate.toFixed(0)}%</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {statistics.totalCompleted} of {statistics.totalPlanned} audits completed
        </p>
      </div>

      {/* Findings by Category */}
      {findingsData.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Findings by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={findingsData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {findingsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chapter Coverage */}
      {chapterCoverage && chapterCoverage.chapters.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">GMP Chapter Coverage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chapterCoverage.chapters}
              layout="vertical"
              margin={{ left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="auditsCompleted" fill="#22c55e" name="Completed" />
              <Bar dataKey="auditsPlanned" fill="#3b82f6" name="Planned" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Average CAPA Closure Time */}
      {statistics.avgCapaClosureTime > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">Average Finding Closure Time</h3>
          <p className="text-3xl font-bold">{statistics.avgCapaClosureTime} days</p>
          <p className="text-sm text-muted-foreground">
            Average time to close findings with CAPA
          </p>
        </div>
      )}
    </div>
  );
}
