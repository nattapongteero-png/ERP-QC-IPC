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
  errorName?: string;
  stack?: string;
  url?: string;
  fullUrl?: string;
  referrer?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  timestamp: string;
  userAgent?: string;
  pathname?: string;
  searchParams?: string;
  viewport?: { width: number; height: number };
  activeElement?: string;
  documentTitle?: string;
  networkStatus?: string;
  sessionId?: string;
  reactVersion?: string;
  domContext?: string;
}

// Only enable in development
const isDev = process.env.NODE_ENV === 'development';

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

// Get error type color
function getTypeColor(type: string): string {
  switch (type) {
    case 'error': return colors.red;
    case 'react-error': return colors.magenta;
    case 'unhandledrejection': return colors.yellow;
    case 'console-error': return colors.cyan;
    default: return colors.white;
  }
}

// Get error type icon
function getTypeIcon(type: string): string {
  switch (type) {
    case 'error': return '💥';
    case 'react-error': return '⚛️';
    case 'unhandledrejection': return '🔥';
    case 'console-error': return '📢';
    default: return '❓';
  }
}

// Parse user agent to get browser info
function parseBrowser(ua: string | undefined): string {
  if (!ua) return 'Unknown Browser';

  if (ua.includes('Chrome')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${match?.[1] || ''}`;
  }
  if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${match?.[1] || ''}`;
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return `Safari ${match?.[1] || ''}`;
  }
  if (ua.includes('Edge')) {
    const match = ua.match(/Edge\/(\d+)/);
    return `Edge ${match?.[1] || ''}`;
  }

  return ua.substring(0, 50);
}

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
      const c = colors;
      const typeColor = getTypeColor(error.type);
      const icon = getTypeIcon(error.type);

      const separator = '═'.repeat(100);
      const thinSeparator = '─'.repeat(100);
      const sectionSeparator = '┄'.repeat(100);

      console.log('\n' + c.bright + typeColor + separator + c.reset);
      console.log(`${icon} ${c.bright}${typeColor} CLIENT ERROR #${index + 1} [${error.type.toUpperCase()}]${c.reset}`);
      if (error.errorName && error.errorName !== 'Error') {
        console.log(`   ${c.dim}Error Type: ${c.reset}${c.yellow}${error.errorName}${c.reset}`);
      }
      console.log(c.dim + thinSeparator + c.reset);

      // URL Section
      console.log(`${c.cyan}📍 URL & LOCATION${c.reset}`);
      console.log(`   ${c.dim}Full URL:${c.reset}     ${error.fullUrl || error.pathname || 'unknown'}`);
      if (error.searchParams) {
        console.log(`   ${c.dim}Query:${c.reset}        ${error.searchParams}`);
      }
      if (error.referrer) {
        console.log(`   ${c.dim}Referrer:${c.reset}     ${error.referrer}`);
      }
      console.log(`   ${c.dim}Page Title:${c.reset}   ${error.documentTitle || 'N/A'}`);

      console.log(c.dim + sectionSeparator + c.reset);

      // Error Message Section
      console.log(`${c.red}💬 ERROR MESSAGE${c.reset}`);
      console.log(`   ${c.bright}${error.message}${c.reset}`);

      if (error.url) {
        console.log(`   ${c.dim}Source:${c.reset} ${error.url}${error.line ? `:${error.line}` : ''}${error.column ? `:${error.column}` : ''}`);
      }

      // Stack Trace Section
      if (error.stack) {
        console.log(c.dim + sectionSeparator + c.reset);
        console.log(`${c.yellow}📚 STACK TRACE${c.reset}`);
        // Clean up stack trace for readability
        const stackLines = error.stack.split('\n');
        const relevantLines = stackLines
          .filter(line => !line.includes('node_modules') || line.includes('_next'))
          .slice(0, 15);
        relevantLines.forEach((line, i) => {
          // Highlight the first line (error message)
          if (i === 0) {
            console.log(`   ${c.red}${line.trim()}${c.reset}`);
          } else {
            // Try to extract file path and highlight it
            const match = line.match(/at\s+(\S+)\s+\((.*?)\)/);
            if (match) {
              const [, fn, loc] = match;
              console.log(`   ${c.dim}at${c.reset} ${c.cyan}${fn}${c.reset} ${c.dim}(${loc})${c.reset}`);
            } else {
              console.log(`   ${c.dim}${line.trim()}${c.reset}`);
            }
          }
        });
        if (stackLines.length > 15) {
          console.log(`   ${c.dim}... (${stackLines.length - 15} more lines)${c.reset}`);
        }
      }

      // Component Stack Section (for React errors)
      if (error.componentStack) {
        console.log(c.dim + sectionSeparator + c.reset);
        console.log(`${c.magenta}⚛️  REACT COMPONENT STACK${c.reset}`);
        const componentLines = error.componentStack.split('\n');
        componentLines.slice(0, 12).forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('[Raw Stack]')) {
            console.log(`   ${c.dim}${trimmed}${c.reset}`);
          } else if (trimmed.includes('→')) {
            // Component chain
            console.log(`   ${c.bright}${c.magenta}${trimmed}${c.reset}`);
          } else if (trimmed.startsWith('at ') || trimmed.startsWith('in ')) {
            const componentMatch = trimmed.match(/(?:at|in)\s+([A-Z][a-zA-Z0-9_]*)/);
            if (componentMatch) {
              console.log(`   ${c.magenta}${componentMatch[1]}${c.reset} ${c.dim}${trimmed.replace(componentMatch[0], '').trim()}${c.reset}`);
            } else {
              console.log(`   ${c.dim}${trimmed}${c.reset}`);
            }
          } else if (trimmed) {
            console.log(`   ${c.dim}${trimmed}${c.reset}`);
          }
        });
      }

      // DOM Context Section (helpful for hydration errors)
      if (error.domContext) {
        console.log(c.dim + sectionSeparator + c.reset);
        console.log(`${c.blue}🏗️  DOM CONTEXT${c.reset}`);
        console.log(`   ${error.domContext}`);
      }

      // Context Section
      console.log(c.dim + sectionSeparator + c.reset);
      console.log(`${c.green}📋 CONTEXT${c.reset}`);
      console.log(`   ${c.dim}Time:${c.reset}         ${new Date(error.timestamp).toLocaleString()}`);
      console.log(`   ${c.dim}Session:${c.reset}      ${error.sessionId || 'N/A'}`);
      console.log(`   ${c.dim}Browser:${c.reset}      ${parseBrowser(error.userAgent)}`);
      if (error.viewport) {
        console.log(`   ${c.dim}Viewport:${c.reset}     ${error.viewport.width}x${error.viewport.height}`);
      }
      if (error.activeElement && error.activeElement !== 'body') {
        console.log(`   ${c.dim}Focus:${c.reset}        ${error.activeElement}`);
      }
      console.log(`   ${c.dim}Network:${c.reset}      ${error.networkStatus || 'unknown'}`);
      if (error.reactVersion && error.reactVersion !== 'unknown') {
        console.log(`   ${c.dim}React:${c.reset}        v${error.reactVersion}`);
      }

      console.log(c.bright + typeColor + separator + c.reset + '\n');
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
