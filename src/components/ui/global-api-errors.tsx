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
  missingPermissions?: string[];
  userRole?: string;
  actionHint?: string;
  onDismiss: () => void;
}

function ErrorItem({ id, error, debug, url, method, missingPermissions, userRole, actionHint, onDismiss }: ErrorItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPermissionError = !!(missingPermissions && missingPermissions.length > 0);

  const copyToClipboard = async () => {
    const permissionLines = isPermissionError
      ? `\nRole: ${userRole}\nMissing Permissions: ${missingPermissions!.join(', ')}\nAction: ${actionHint || ''}`
      : '';
    const text = debug
      ? `Error: ${error}\nURL: ${url}\nMethod: ${method}${permissionLines}\n\nDebug Details:\n${JSON.stringify(debug, null, 2)}`
      : `Error: ${error}\nURL: ${url}\nMethod: ${method}${permissionLines}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-white rounded-lg shadow-xl border overflow-hidden max-w-2xl w-full ${isPermissionError ? 'border-amber-200' : 'border-red-200'}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-start gap-3 ${isPermissionError ? 'bg-amber-50' : 'bg-red-50'}`}>
        <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isPermissionError ? 'text-amber-500' : 'text-red-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${isPermissionError ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {method || 'GET'}
            </span>
            {isPermissionError && (
              <span className="text-xs font-bold bg-amber-600 text-white px-2 py-0.5 rounded">
                🔒 ขาดสิทธิ์
              </span>
            )}
            <span className={`text-xs truncate ${isPermissionError ? 'text-amber-600' : 'text-red-600'}`}>{url}</span>
          </div>
          <p className={`font-medium ${isPermissionError ? 'text-amber-900' : 'text-red-800'}`}>{error}</p>
          {isPermissionError && (
            <div className="mt-2 p-2 bg-white/60 rounded border border-amber-300 text-xs">
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                <span className="text-amber-700 font-semibold">Role ปัจจุบัน:</span>
                <code className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-mono">{userRole}</code>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-amber-700 font-semibold">Permission ที่ขาด:</span>
                {missingPermissions!.map((perm) => (
                  <code key={perm} className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-mono text-[11px]">
                    {perm}
                  </code>
                ))}
              </div>
              {actionHint && (
                <p className="mt-2 text-amber-800 flex items-start gap-1">
                  <span>💡</span>
                  <span>{actionHint}</span>
                </p>
              )}
            </div>
          )}
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
          missingPermissions={err.missingPermissions}
          userRole={err.userRole}
          actionHint={err.actionHint}
          onDismiss={() => dismissError(err.id)}
        />
      ))}
    </div>
  );
}

GlobalApiErrors.displayName = 'GlobalApiErrors';
