// Kills orphaned vitest processes left behind when a test run is interrupted
// before its worker tree exits. This happens often on this RAM-constrained
// machine: under memory pressure a run crawls, the terminal/agent that launched
// it times out, but the bunx -> vitest -> worker process tree keeps running and
// accumulates. A pile of orphans then makes RAM worse and every later run looks
// "stuck". Run `bun run test:clean` to clear them.
//
// Safe by design: only targets node/bun processes whose command line mentions
// "vitest" — never the dev server, MCP servers, or editor processes.
import { execSync } from 'node:child_process';
import os from 'node:os';

try {
  if (os.platform() === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -or $_.Name -eq 'bun.exe') -and $_.CommandLine -match 'vitest' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore' }
    );
  } else {
    execSync('pkill -f vitest', { stdio: 'ignore', shell: '/bin/sh' });
  }
  console.log('[test:clean] orphaned vitest processes cleared');
} catch {
  // pkill exits non-zero when nothing matched — that's the happy path here.
  console.log('[test:clean] no orphaned vitest processes found');
}
