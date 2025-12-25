'use client';

/**
 * Master Data Index Page
 * Dashboard for accessing all master data management pages.
 */

import Link from 'next/link';
import { ResponsivePageHeader } from '@/components/shared';
import {
  Database,
  Building2,
  Wrench,
  Thermometer,
  FileText,
  Scale,
  ChevronRight
} from 'lucide-react';

const masterDataModules = [
  {
    title: 'Production Rooms',
    description: 'Manage production rooms and areas for GMP compliance',
    href: '/master-data/production-rooms',
    icon: Building2,
    iconBgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Production Equipment',
    description: 'Manage production equipment like scales, mixers, and tools',
    href: '/master-data/production-equipment',
    icon: Wrench,
    iconBgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    title: 'Environmental Conditions',
    description: 'Define temperature and humidity monitoring profiles',
    href: '/master-data/environmental-conditions',
    icon: Thermometer,
    iconBgColor: 'bg-teal-100',
    iconColor: 'text-teal-600',
  },
  {
    title: 'SOP Templates',
    description: 'Create reusable SOP step templates for production processes',
    href: '/master-data/sop-templates',
    icon: FileText,
    iconBgColor: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    title: 'Packaging QC Criteria',
    description: 'Define packaging weight and quality control criteria',
    href: '/master-data/packaging-qc-criteria',
    icon: Scale,
    iconBgColor: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
];

export default function MasterDataPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Master Data"
        subtitle="Manage production master data for GMP compliance"
        icon={Database}
        iconBgColor="bg-gray-100"
        iconColor="text-gray-600"
      />

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {masterDataModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${module.iconBgColor} flex items-center justify-center`}>
                <module.icon className={`h-6 w-6 ${module.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {module.title}
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-gray-500 mt-1">{module.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">About Master Data</h3>
        <p className="text-sm text-blue-700">
          Master Data defines the lookup lists and configuration profiles used across the production system.
          These settings control BOM requirements, work order execution, and GMP compliance documentation.
        </p>
        <ul className="mt-3 text-sm text-blue-700 space-y-1">
          <li>• <strong>Production Rooms</strong> - Define areas where production activities occur</li>
          <li>• <strong>Production Equipment</strong> - Register equipment used in production</li>
          <li>• <strong>Environmental Conditions</strong> - Set temperature/humidity monitoring profiles</li>
          <li>• <strong>SOP Templates</strong> - Create reusable production step templates</li>
          <li>• <strong>Packaging QC Criteria</strong> - Define weight and quality control standards</li>
        </ul>
      </div>
    </div>
  );
}
