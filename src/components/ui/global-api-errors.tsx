'use client';

import { useState } from 'react';
import { useApiErrors } from '@/contexts/api-error-context';
import { AlertCircle, X, ChevronDown, ChevronUp, Copy, Check, Bug } from 'lucide-react';

interface ErrorDetails {
  message: string;
  stack?: string;
  name?: string;
  cause?: string;
  code?: string;
  path?: string;
  timestamp: string;
}

interface ErrorItemProps {
  id: string;
  error: string;
  debug?: ErrorDetails;
  url?: string;
  method?: string;
  onDismiss: () => void;
}

function ErrorItem({ id, error, debug, url, method, onDismiss }: ErrorItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const text = debug
      ? `Error: ${error}\nURL: ${url}\nMethod: ${method}\n\nDebug Details:\n${JSON.stringify(debug, null, 2)}`
      : `Error: ${error}\nURL: ${url}\nMethod: ${method}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-red-200 overflow-hidden max-w-2xl w-full">
      {/* Header */}
      <div className="bg-red-50 px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded">
              {method || 'GET'}
            </span>
            <span className="text-xs text-red-600 truncate">{url}</span>
          </div>
          <p className="text-red-800 font-medium">{error}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={copyToClipboard}
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            title="Copy error details"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-red-400" />
            )}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Debug toggle */}
      {debug && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-red-100"
          >
            <span className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug Details
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {expanded && (
            <div className="px-4 py-3 space-y-3 border-t border-red-100 bg-gray-50">
              {/* Error info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {debug.name && (
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 font-mono text-gray-800">{debug.name}</span>
                  </div>
                )}
                {debug.code && (
                  <div>
                    <span className="text-gray-500">Code:</span>
                    <span className="ml-2 font-mono text-gray-800">{debug.code}</span>
                  </div>
                )}
                {debug.path && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Path:</span>
                    <span className="ml-2 font-mono text-gray-800">{debug.path}</span>
                  </div>
                )}
                {debug.timestamp && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Time:</span>
                    <span className="ml-2 font-mono text-gray-800">
                      {new Date(debug.timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Message:</p>
                <pre className="p-2 bg-red-100 rounded text-xs font-mono text-red-800 whitespace-pre-wrap break-words">
                  {debug.message}
                </pre>
              </div>

              {/* Stack trace */}
              {debug.stack && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Stack Trace:</p>
                  <pre className="p-2 bg-gray-900 rounded text-xs font-mono text-green-400 whitespace-pre-wrap break-words overflow-x-auto max-h-48 overflow-y-auto">
                    {debug.stack}
                  </pre>
                </div>
              )}

              {/* Cause */}
              {debug.cause && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cause:</p>
                  <pre className="p-2 bg-red-100 rounded text-xs font-mono text-red-800 whitespace-pre-wrap break-words">
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

ErrorItem.displayName = 'ErrorItem';

export function GlobalApiErrors() {
  const { errors, dismissError } = useApiErrors();

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-h-[80vh] overflow-y-auto">
      {errors.map((err) => (
        <ErrorItem
          key={err.id}
          id={err.id}
          error={err.error}
          debug={err.debug}
          url={err.url}
          method={err.method}
          onDismiss={() => dismissError(err.id)}
        />
      ))}
    </div>
  );
}

GlobalApiErrors.displayName = 'GlobalApiErrors';
