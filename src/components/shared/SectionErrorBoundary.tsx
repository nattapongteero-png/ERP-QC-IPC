'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  /** Shown to the operator when this section fails to render. */
  label?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * Isolates a non-critical section so a render crash inside it (e.g. a transient
 * non-array shape during navigation) degrades to a small inline notice instead
 * of white-screening the whole page via the global error boundary. The real
 * error + component stack are logged for diagnosis.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error(
      `[SectionErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`,
      error,
      info?.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ส่วนนี้แสดงผลไม่สำเร็จชั่วคราว{this.props.label ? ` (${this.props.label})` : ''} —
          ลองรีเฟรชหน้าอีกครั้ง
        </div>
      );
    }
    return this.props.children;
  }
}
