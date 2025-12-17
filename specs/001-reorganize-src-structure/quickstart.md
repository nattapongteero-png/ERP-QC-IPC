# Quickstart: Reorganize Source Code Structure

**Feature**: 001-reorganize-src-structure
**Date**: 2025-12-17

## Overview

This quickstart guide provides step-by-step instructions to implement the source code reorganization and verify the changes work correctly.

## Prerequisites

- Git repository is clean (no uncommitted changes)
- Node.js and pnpm installed
- Docker installed (for Docker verification)

## Implementation Steps

### Step 1: Create docker/ Directory and Move Files

```bash
# Create docker directory
mkdir -p docker

# Move Docker files preserving git history
git mv Dockerfile docker/Dockerfile
git mv Dockerfile.dev docker/Dockerfile.dev
git mv docker-compose.yml docker/docker-compose.yml
git mv docker-compose.dev.yml docker/docker-compose.dev.yml
git mv .dockerignore docker/.dockerignore
git mv DOCKER.md docker/README.md

# Move documentation
git mv HANDOFF_SUMMARY.md docs/HANDOFF_SUMMARY.md
```

### Step 2: Update docker-compose.yml Paths

Edit `docker/docker-compose.yml`:

```yaml
# Update all build contexts from:
build:
  context: .
  dockerfile: Dockerfile

# To:
build:
  context: ..
  dockerfile: docker/Dockerfile
```

### Step 3: Update docker-compose.dev.yml Paths

Edit `docker/docker-compose.dev.yml`:

```yaml
# Update build context and dockerfile:
build:
  context: ..
  dockerfile: docker/Dockerfile.dev

# Update volume mount from:
volumes:
  - .:/app

# To:
volumes:
  - ..:/app
```

### Step 4: Cleanup (Optional)

```bash
# Remove development convenience script if not needed
rm start_claude.sh
```

## Verification Checklist

Run these commands to verify the reorganization was successful:

### 1. TypeScript Check
```bash
pnpm tsc --noEmit
# Expected: No errors
```

### 2. Linting Check
```bash
pnpm lint
# Expected: No errors
```

### 3. Unit Tests
```bash
pnpm test:run
# Expected: All tests pass
```

### 4. Build Check
```bash
pnpm build
# Expected: Build succeeds
```

### 5. Docker Compose Validation
```bash
docker-compose -f docker/docker-compose.yml config
# Expected: Valid YAML output, no errors
```

### 6. Docker Build (Optional - requires Docker)
```bash
docker build -f docker/Dockerfile .
# Expected: Build succeeds
```

### 7. Git History Verification
```bash
git log --follow docker/Dockerfile
# Expected: Shows history from before the move
```

### 8. Root Directory Check
```bash
ls -la | grep -E "^-" | wc -l
# Expected: 11 or fewer regular files (config files only)
```

## Updated Docker Commands

After reorganization, use these commands:

| Purpose | Command |
|---------|---------|
| Production (SQLite) | `docker-compose -f docker/docker-compose.yml up -d` |
| Production (MySQL) | `docker-compose -f docker/docker-compose.yml --profile mysql up -d` |
| Development | `docker-compose -f docker/docker-compose.dev.yml up` |
| Build image | `docker build -f docker/Dockerfile -t herbal-erp .` |
| Stop containers | `docker-compose -f docker/docker-compose.yml down` |

## Rollback

If issues occur, rollback with:

```bash
git checkout HEAD~1 -- .
# Or reset completely:
git reset --hard HEAD~1
```

## Success Criteria Verification

| Criteria | Verification Command | Expected Result |
|----------|---------------------|-----------------|
| SC-001: Clean root | `ls -la \| grep -v "^d" \| wc -l` | ≤ 15 items |
| SC-002: Tests pass | `pnpm test:run` | All pass |
| SC-003: Build works | `pnpm build` | Exit code 0 |
| SC-004: Dev server works | `pnpm dev` | Server starts |
| SC-005: Docker works | `docker-compose -f docker/docker-compose.yml config` | Valid output |
| SC-007: Git history | `git log --follow docker/Dockerfile` | Shows history |
