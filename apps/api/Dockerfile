# Multi-stage Docker build for Telehealth CRM API
# HIPAA-compliant production container

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY apps/api/src ./apps/api/src
COPY packages/db ./packages/db
COPY tsconfig.json ./
COPY apps/api/tsconfig.json ./apps/api/

# Generate Prisma client
RUN cd packages/db && npx prisma generate

# Build application
RUN cd apps/api && npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/db/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/db/prisma ./prisma

# Copy package files
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
