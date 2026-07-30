# Stage 1: Dependencies
# Pin bun to the 1.2 line. The floating `oven/bun:1-alpine` tag moved to 1.3.14,
# which fails with "error: Fail extracting tarball" on xlsx/jspdf/next and breaks
# the build. bun 1.2.23 installs all 907 packages cleanly (bun.lock is v1, which
# needs bun >= 1.2, so 1.1 can't read it either).
FROM oven/bun:1.2-alpine AS deps
# Install build tools for native modules (better-sqlite3 requires Python, make, g++)
RUN apk add --no-cache libc6-compat python3 make g++ linux-headers
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Install libc6-compat for native module compatibility and Node.js for Next.js build
RUN apk add --no-cache libc6-compat nodejs

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

# Build the application (Next.js build uses Node.js internally)
# bun run build uses --webpack flag (Turbopack has issues with next/font/google)
RUN bun run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Alpine's native Chromium for CoA PDF rendering. The bundled
# @sparticuz/chromium binary is built against glibc (Lambda/Debian) and
# fails on Alpine's musl with "symbol not found" errors. Using Alpine's
# chromium package + CHROMIUM_PATH lets puppeteer-core spawn the system
# binary reliably. Font packages cover Thai + emoji glyphs.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto \
      font-noto-thai
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Ensure the uploads directory is owned by the runtime user so the HR photo
# upload endpoint (/api/hr/employees/[id]/photo) can mkdir per-employee
# subfolders and write webp files. In production this path is usually
# bind-mounted from the host for persistence, and the host mkdir script
# matches the same uid (1001).
RUN mkdir -p /app/public/uploads/employees && chown -R nextjs:nodejs /app/public/uploads

# Set user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
