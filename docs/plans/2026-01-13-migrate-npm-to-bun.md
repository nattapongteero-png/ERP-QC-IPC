# Migrate npm/pnpm to Bun Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace npm/pnpm with Bun in Docker builds for significantly faster dependency installation and build times.

**Architecture:** Bun is a fast JavaScript runtime with a built-in package manager. We'll update Docker images to use oven/bun base images instead of node-alpine, generate bun.lockb from package.json, and update all scripts to use bun commands. The multi-stage Dockerfile pattern will be preserved.

**Tech Stack:** Bun 1.x, Docker (oven/bun images), Next.js 16

---

## Task 1: Generate bun.lockb and Clean Up Old Lockfiles

**Files:**
- Create: `bun.lockb` (binary lockfile)
- Delete: `pnpm-lock.yaml`
- Delete: `package-lock.json`
- Modify: `.dockerignore:92-93`

**Step 1: Install Bun locally (if not installed)**

Run:
```bash
curl -fsSL https://bun.sh/install | bash
```

Or if already installed, skip this step.

**Step 2: Generate bun.lockb from package.json**

Run:
```bash
cd /home/manoi/docker/herbal-medicine-erp && bun install
```

Expected: Creates `bun.lockb` file and `node_modules/`

**Step 3: Verify lockfile was created**

Run:
```bash
ls -la /home/manoi/docker/herbal-medicine-erp/bun.lockb
```

Expected: File exists with non-zero size

**Step 4: Delete old lockfiles**

Run:
```bash
rm -f /home/manoi/docker/herbal-medicine-erp/pnpm-lock.yaml /home/manoi/docker/herbal-medicine-erp/package-lock.json
```

**Step 5: Update .dockerignore to exclude old lockfiles, include bun.lockb**

Replace line 92-93:
```diff
-# Package manager files (lockfile needed, but not all)
-package-lock.json
+# Package manager files (only bun.lockb needed)
+package-lock.json
+pnpm-lock.yaml
+yarn.lock
```

**Step 6: Commit**

```bash
git add bun.lockb .dockerignore
git commit -m "chore: migrate to bun - add bun.lockb, remove pnpm/npm lockfiles"
```

---

## Task 2: Update Production Dockerfile to Use Bun

**Files:**
- Modify: `docker/Dockerfile`

**Step 1: Replace entire Dockerfile with Bun-based version**

```dockerfile
# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install Node.js for Next.js build (Bun's Next.js support is experimental)
RUN apk add --no-cache nodejs npm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Limit build parallelism to reduce CPU usage (adjust number as needed)
# --max-old-space-size limits memory, UV_THREADPOOL_SIZE limits I/O threads
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV UV_THREADPOOL_SIZE=4

# Build the application using Node (Next.js build requires Node)
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Set user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
```

**Step 2: Verify Dockerfile syntax**

Run:
```bash
docker build --check -f /home/manoi/docker/herbal-medicine-erp/docker/Dockerfile /home/manoi/docker/herbal-medicine-erp 2>&1 | head -20 || echo "Syntax check done"
```

**Step 3: Commit**

```bash
git add docker/Dockerfile
git commit -m "chore: update production Dockerfile to use Bun for deps"
```

---

## Task 3: Update Development Dockerfile to Use Bun

**Files:**
- Modify: `docker/Dockerfile.dev`

**Step 1: Replace entire Dockerfile.dev with Bun-based version**

```dockerfile
# Development Dockerfile with hot reload
FROM oven/bun:1-alpine

WORKDIR /app

# Install dependencies for native modules and Node.js for Next.js dev server
RUN apk add --no-cache libc6-compat python3 make g++ nodejs npm

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies with Bun (much faster than npm/pnpm)
RUN bun install

# Copy source code
COPY . .

# Environment variables for development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Expose port
EXPOSE 3000

# Start development server with hot reload (using npm since Next.js dev needs Node)
CMD ["npm", "run", "dev"]
```

**Step 2: Commit**

```bash
git add docker/Dockerfile.dev
git commit -m "chore: update dev Dockerfile to use Bun for deps"
```

---

## Task 4: Test Docker Build Locally

**Files:**
- None (testing only)

**Step 1: Build production image**

Run:
```bash
cd /home/manoi/docker/herbal-medicine-erp && docker build -f docker/Dockerfile -t herbal-erp-test:bun . 2>&1 | tail -50
```

Expected: Build completes successfully (look for "Successfully tagged herbal-erp-test:bun")

**Step 2: Check build time**

Note the total build time in the output. Bun's `install` step should be significantly faster than pnpm/npm.

**Step 3: Verify the image runs**

Run:
```bash
docker run --rm -e DB_TYPE=sqlite -e JWT_SECRET=test herbal-erp-test:bun node -e "console.log('OK')"
```

Expected: Prints "OK"

**Step 4: Clean up test image**

Run:
```bash
docker rmi herbal-erp-test:bun
```

---

## Task 5: Update package.json Scripts (Optional Enhancement)

**Files:**
- Modify: `package.json` (scripts section only)

This task is optional - the current npm scripts work fine since they're executed inside containers. However, for local development outside Docker, you may want to support bun commands.

**Step 1: Add bun-specific scripts (if desired)**

No changes needed - npm scripts work with bun. The `bun run` command is compatible with npm scripts.

**Step 2: Skip this task**

Since Docker containers use `npm run` for Next.js commands (which works fine), no package.json changes are needed.

---

## Task 6: Final Verification and Commit

**Files:**
- None (verification only)

**Step 1: Verify all changes are committed**

Run:
```bash
cd /home/manoi/docker/herbal-medicine-erp && git status
```

Expected: Clean working directory or only untracked files

**Step 2: Run type check**

Run:
```bash
cd /home/manoi/docker/herbal-medicine-erp && npx tsc --noEmit --skipLibCheck
```

Expected: No errors

**Step 3: Run tests**

Run:
```bash
cd /home/manoi/docker/herbal-medicine-erp && npm run test:run -- --passWithNoTests 2>&1 | tail -20
```

Expected: Tests pass

**Step 4: Create final summary commit if needed**

If any fixes were needed:
```bash
git add -A
git commit -m "chore: finalize bun migration"
```

---

## Summary

After completing these tasks:

1. **Dependencies stage** uses `oven/bun:1-alpine` image with `bun install --frozen-lockfile`
2. **Builder stage** uses Bun for node_modules but Node.js for Next.js build (Next.js build requires Node)
3. **Runner stage** remains `node:20-alpine` (Next.js standalone output requires Node runtime)
4. **Dev Dockerfile** uses Bun for fast dependency installation
5. Old lockfiles (`pnpm-lock.yaml`, `package-lock.json`) are removed
6. New `bun.lockb` is used for deterministic installs

**Expected Performance Improvement:**
- `bun install` is typically 10-25x faster than `npm install` and 3-5x faster than `pnpm install`
- Total Docker build time should decrease significantly due to faster dependency resolution
