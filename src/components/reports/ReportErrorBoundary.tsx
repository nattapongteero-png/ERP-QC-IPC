'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ReportErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console
    console.error('Report Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-lg shadow-sm overflow-hidden">
            {/* Error Header */}
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-800">Report Error</h3>
                  <p className="text-sm text-red-600">
                    Something went wrong while loading the report
                  </p>
                </div>
              </div>
            </div>

            {/* Error Details */}
            <div className="px-6 py-4">
              {this.state.error && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Error Message:</div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-600 font-mono break-all">
                    {this.state.error.message}
                  </div>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">Component Stack:</div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-500 font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 mb-4">
                Try the actions below to resolve this issue:
              </div>

              <ul className="text-sm text-gray-600 list-disc list-inside mb-4 space-y-1">
                <li>Check if the reporting backend is running</li>
                <li>Verify the report template exists</li>
                <li>Ensure you have permission to view this report</li>
                <li>Check your network connection</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex gap-3">
                <button
                  onClick={this.handleRetry}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 px-4 py-2 bg-red-600 border border-red-600 rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
