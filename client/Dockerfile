# Multi-stage Dockerfile for Next.js client (standalone output)
# Build context: PRODUCTS/yhealth-app/ (the root, NOT client/)
# Build: docker build -t yhealth-client -f client/Dockerfile .
# Run:   docker run -p 3000:3000 yhealth-client

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY client/package.json client/package-lock.json ./client/

# Install all dependencies (devDependencies needed for build in next stage)
WORKDIR /app/client
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package.json (Next.js uses it to detect monorepo root)
COPY package.json ./

# Copy shared types (tsconfig paths: @shared/* -> ../shared/*)
COPY shared/ ./shared/

# Copy dependencies from deps stage
COPY --from=deps /app/client/node_modules ./client/node_modules

# Copy client source
COPY client/ ./client/

# Accept build-time environment variables (NEXT_PUBLIC_* are baked into the bundle)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js with standalone output
WORKDIR /app/client
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy standalone output
# Next.js standalone preserves the monorepo directory structure:
#   .next/standalone/client/server.js   (entry point)
#   .next/standalone/client/.next/      (server chunks)
#   .next/standalone/node_modules/      (traced root deps)
COPY --from=builder --chown=nodejs:nodejs /app/client/.next/standalone ./

# Copy static assets (not included in standalone output)
COPY --from=builder --chown=nodejs:nodejs /app/client/.next/static ./.next/static

# Copy public assets
COPY --from=builder --chown=nodejs:nodejs /app/client/public ./public

USER nodejs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
