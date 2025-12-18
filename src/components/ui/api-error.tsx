'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from './button';

interface ErrorDetails {
  message: string;
  stack?: string;
  name?: string;
  cause?: string;
  code?: string;
  path?: string;
  timestamp: string;
}

interface ApiErrorProps {
  error: string;
  debug?: ErrorDetails;
  onRetry?: () => void;
  className?: string;
}

export function ApiError({ error, debug, onRetry, className = '' }: ApiErrorProps) {
  const [showDetails, setShowDetails] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const errorText = debug
      ? `Error: ${error}\n\nDetails:\n${JSON.stringify(debug, null, 2)}`
      : error;

    await navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            title="Copy error details"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Debug Details (only shown if debug info exists) */}
      {debug && (
        <>
          <div className="border-t border-red-200">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors"
            >
              <span className="font-medium">Debug Details</span>
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {showDetails && (
            <div className="border-t border-red-200 p-4 space-y-4">
              {/* Error Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {debug.name && (
                  <div>
                    <span className="text-red-500 font-medium">Type:</span>
                    <p className="text-red-800 font-mono">{debug.name}</p>
                  </div>
                )}
                {debug.code && (
                  <div>
                    <span className="text-red-500 font-medium">Code:</span>
                    <p className="text-red-800 font-mono">{debug.code}</p>
                  </div>
                )}
                {debug.path && (
                  <div>
                    <span className="text-red-500 font-medium">Path:</span>
                    <p className="text-red-800 font-mono">{debug.path}</p>
                  </div>
                )}
                {debug.timestamp && (
                  <div>
                    <span className="text-red-500 font-medium">Time:</span>
                    <p className="text-red-800 font-mono text-xs">
                      {new Date(debug.timestamp).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              <div>
                <span className="text-red-500 font-medium text-sm">Message:</span>
                <pre className="mt-1 p-3 bg-red-100 rounded text-red-800 text-sm font-mono whitespace-pre-wrap break-words">
                  {debug.message}
                </pre>
              </div>

              {/* Stack Trace */}
              {debug.stack && (
                <div>
                  <span className="text-red-500 font-medium text-sm">Stack Trace:</span>
                  <pre className="mt-1 p-3 bg-gray-900 rounded text-green-400 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-64 overflow-y-auto">
                    {debug.stack}
                  </pre>
                </div>
              )}

              {/* Cause */}
              {debug.cause && (
                <div>
                  <span className="text-red-500 font-medium text-sm">Cause:</span>
                  <pre className="mt-1 p-3 bg-red-100 rounded text-red-800 text-sm font-mono whitespace-pre-wrap break-words">
                    {debug.cause}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
