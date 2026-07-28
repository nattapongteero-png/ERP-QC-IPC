#!/usr/bin/env node
/**
 * Done-gate for Claude Code on this repo.
 *
 * Runs as a Stop hook: every time the assistant finishes a turn, this checks
 * the things it kept forgetting on 2026-07-28 and feeds any failures back so
 * they cannot be quietly skipped. The user should not have to be the one who
 * notices that GitHub was 43 commits behind, or that a UI change was never
 * looked at.
 *
 * Exit 0            = nothing to say.
 * Exit 2 + stderr   = blocking reason, shown back to the assistant.
 */
import { execSync } from 'node:child_process';

const REPO = 'C:\\Herbal ERP\\herbal-medicine-erp';
const sh = (cmd) => {
  try {
    return execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const problems = [];

// 1. Uncommitted source. Docker builds from the working tree, so an uncommitted
//    file can ship to UAT while living in no commit and no remote.
const dirty = sh('git status --porcelain')
  .split('\n')
  .filter((l) => /^\s*[MARD]/.test(l) && /\.(ts|tsx|css|json)$/.test(l))
  .map((l) => l.slice(3));
if (dirty.length) {
  problems.push(`UNCOMMITTED source (${dirty.length}): ${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? ' …' : ''}`);
}

// 2. Both remotes. This repo has gitlab AND origin(GitHub) and both must be fed.
for (const remote of ['gitlab', 'origin']) {
  const has = sh(`git remote`).split('\n').includes(remote);
  if (!has) continue;
  const ahead = sh(`git rev-list --count ${remote}/main..HEAD`);
  if (ahead && ahead !== '0') {
    problems.push(`NOT PUSHED to ${remote}: ${ahead} commit(s) ahead. Run: git push ${remote} main`);
  }
}

// 3. A UI change with no screenshot taken. Reading code is not looking at it.
const uiTouched = sh('git diff --name-only HEAD~3..HEAD 2>/dev/null')
  .split('\n')
  .some((f) => f.endsWith('.tsx') || f.endsWith('globals.css'));
const shotSeen = sh('git status --porcelain --ignored')
  .split('\n')
  .some((l) => /shot.*\.png/i.test(l));
if (uiTouched && !shotSeen) {
  problems.push(
    'UI files changed but no screenshot found. Capture the DEPLOYED page at 1920 AND 1440 and Read the .png before claiming it is done.',
  );
}

// 4. Typecheck. Baseline is 5 pre-existing errors; anything above that is mine.
//    Only run when source actually changed — tsc is slow and this fires on
//    every turn, including pure conversation.
const srcChanged =
  dirty.length > 0 ||
  sh('git diff --name-only HEAD~3..HEAD 2>/dev/null')
    .split('\n')
    .some((f) => f.startsWith('src/'));
const TYPECHECK_BASELINE = 5;
if (srcChanged) {
  const count = Number(
    sh('bunx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS"') || '0',
  );
  if (count > TYPECHECK_BASELINE) {
    problems.push(
      `TYPECHECK regressed: ${count} errors (baseline ${TYPECHECK_BASELINE}). Run: bunx tsc --noEmit --skipLibCheck`,
    );
  }
}

// 5. Deployed marker. A change that is committed and pushed but never deployed
//    is invisible to the user — they can only see UAT. If the buildMarker in
//    the working tree differs from the one UAT is serving, the deploy is
//    outstanding.
const localMarker = (sh('grep -o "HERBAL-BUILD-[a-zA-Z0-9._-]*" src/app/api/health/route.ts') || '').split('\n')[0];
if (localMarker && srcChanged) {
  const liveMarker = (
    sh('curl -s --max-time 20 https://herbal-erp-test-uat.bmscloud.in.th/api/health | grep -o "HERBAL-BUILD-[a-zA-Z0-9._-]*"') || ''
  ).split('\n')[0];
  if (liveMarker && liveMarker !== localMarker) {
    problems.push(
      `NOT DEPLOYED: UAT is serving "${liveMarker}" but the working tree says "${localMarker}". Build, ship the image, recreate app-uat, then curl /api/health to confirm.`,
    );
  }
}

if (problems.length) {
  console.error(
    `\n[done-gate] ${problems.length} item(s) outstanding — do not report this as finished yet:\n` +
      problems.map((p) => `  • ${p}`).join('\n') +
      '\nIf a point genuinely does not apply, say so explicitly to the user rather than ignoring it.\n',
  );
  process.exit(2);
}
process.exit(0);
