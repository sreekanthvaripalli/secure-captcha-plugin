# Multi-stage build for production-ready secure-captcha-plugin
# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (skip prepare script to avoid husky install)
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Add labels for metadata
LABEL maintainer="secure-captcha-team"
LABEL version="1.0.0"
LABEL description="Enterprise-grade secure CAPTCHA plugin"

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    tini \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S captcha && \
    adduser -S captcha -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (skip prepare script to avoid husky install)
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY --chown=captcha:captcha . .

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R captcha:captcha /app

# Switch to non-root user
USER captcha

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/server.js"]