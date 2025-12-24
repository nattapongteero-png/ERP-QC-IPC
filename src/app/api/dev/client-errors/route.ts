/**
 * Client Error Reporting API (Development Only)
 *
 * Receives browser errors and logs them to the server console
 * for easy inspection during development with multiple testers.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ClientError {
  type: 'error' | 'unhandledrejection' | 'react-error' | 'console-error';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  timestamp: string;
  userAgent?: string;
  pathname?: string;
}

// Only enable in development
const isDev = process.env.NODE_ENV === 'development';

export async function POST(request: NextRequest) {
  // Only process in development mode
  if (!isDev) {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 403 });
  }

  try {
    const errors: ClientError[] = await request.json();

    if (!Array.isArray(errors) || errors.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // Log each error with formatting for visibility
    errors.forEach((error, index) => {
      const separator = '═'.repeat(80);
      const thinSeparator = '─'.repeat(80);

      console.log('\n' + separator);
      console.log(`🌐 CLIENT ERROR #${index + 1} [${error.type.toUpperCase()}]`);
      console.log(thinSeparator);
      console.log(`📍 Page: ${error.pathname || 'unknown'}`);
      console.log(`⏰ Time: ${error.timestamp}`);
      console.log(`💬 Message: ${error.message}`);

      if (error.url) {
        console.log(`📁 File: ${error.url}${error.line ? `:${error.line}` : ''}${error.column ? `:${error.column}` : ''}`);
      }

      if (error.stack) {
        console.log(thinSeparator);
        console.log('📚 Stack Trace:');
        // Clean up stack trace for readability
        const stackLines = error.stack.split('\n').slice(0, 10);
        stackLines.forEach(line => console.log('   ' + line.trim()));
        if (error.stack.split('\n').length > 10) {
          console.log('   ... (truncated)');
        }
      }

      if (error.componentStack) {
        console.log(thinSeparator);
        console.log('⚛️  React Component Stack:');
        const componentLines = error.componentStack.split('\n').slice(0, 8);
        componentLines.forEach(line => console.log('   ' + line.trim()));
      }

      if (error.userAgent) {
        console.log(thinSeparator);
        console.log(`🖥️  Browser: ${error.userAgent.substring(0, 100)}`);
      }

      console.log(separator + '\n');
    });

    return NextResponse.json({
      success: true,
      processed: errors.length,
      message: `Logged ${errors.length} client error(s) to server console`
    });
  } catch (error) {
    console.error('Failed to process client error report:', error);
    return NextResponse.json({ success: false, error: 'Failed to process error report' }, { status: 500 });
  }
}
