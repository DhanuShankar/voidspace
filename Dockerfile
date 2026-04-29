# ============================================================================
# VOID Cloud IDE - Multi-Stage Docker Build
# ============================================================================
# Stage 1: Build frontend assets with Vite
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY src ./src
COPY index.html ./
COPY metadata.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build frontend
RUN npm run build

# ============================================================================
# Stage 2: Production runtime
# ============================================================================
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server.ts ./
COPY src ./src
COPY src/lib/metrics.ts ./src/lib/metrics.ts

# Create directories for logs and runtime data
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server.ts"]
