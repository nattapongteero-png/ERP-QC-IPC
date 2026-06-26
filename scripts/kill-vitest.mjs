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

// `-notmatch 'kill-vitest'` is essential: this script's own command line
// ("node scripts/kill-vitest.mjs") contains "vitest", so without the guard it
// would kill itself (and its parent bun) and exit non-zero.
try {
  if (os.platform() === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -or $_.Name -eq 'bun.exe') -and $_.CommandLine -match 'vitest' -and $_.CommandLine -notmatch 'kill-vitest' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore' }
    );
  } else {
    execSync(
      `ps -eo pid,args | grep -i vitest | grep -v kill-vitest | grep -v grep | awk '{print $1}' | xargs -r kill -9`,
      { stdio: 'ignore', shell: '/bin/sh' }
    );
  }
  console.log('[test:clean] orphaned vitest processes cleared');
} catch {
  console.log('[test:clean] no orphaned vitest processes found');
}
