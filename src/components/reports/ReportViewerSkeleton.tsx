'use client';

interface ReportViewerSkeletonProps {
  className?: string;
}

export default function ReportViewerSkeleton({ className = '' }: ReportViewerSkeletonProps) {
  return (
    <div className={`report-viewer-skeleton bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar Skeleton */}
      <div className="bg-gray-100 border-b border-gray-200 p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* Navigation buttons skeleton */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            ))}
            {/* Page indicator skeleton */}
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom dropdown skeleton */}
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            {/* Action buttons skeleton */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Report Content Skeleton */}
      <div className="p-6">
        {/* Report header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-2/3 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Report table skeleton */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="bg-gray-100 border-b border-gray-200 p-3">
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Table rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="border-b border-gray-100 last:border-b-0 p-3">
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((col) => (
                  <div
                    key={col}
                    className="h-4 flex-1 bg-gray-100 rounded animate-pulse"
                    style={{ animationDelay: `${(row * 5 + col) * 50}ms` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Report footer skeleton */}
        <div className="mt-6 flex justify-between items-center">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="flex justify-center items-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
