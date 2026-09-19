# Base image with Node and pnpm setup
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

# Stage to build dependencies and applications
FROM base AS builder
# Copy configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./

# Copy package.json files for dependency caching
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/traclytag/package.json ./artifacts/traclytag/
COPY scripts/package.json ./scripts/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the source code
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/

# Remove any tsbuildinfo files in the container to guarantee clean builds
RUN find . -name "*.tsbuildinfo" -delete

# Build backend dist and frontend production bundle
RUN pnpm run build

# Runner Target Stage
FROM base AS runner
WORKDIR /app

# Install supervisor, nginx, certbot, and openssl
RUN apk add --no-cache supervisor nginx certbot certbot-nginx openssl && \
    mkdir -p /var/log/supervisor /run/nginx /etc/letsencrypt

# Copy built code and dependencies from builder stage
COPY --from=builder /app /app

# Copy supervisor, nginx configurations, and nginx entrypoint script
COPY supervisord.conf /etc/supervisord.conf
COPY nginx-container.conf /etc/nginx/http.d/default.conf
COPY entrypoint-nginx.sh /app/entrypoint-nginx.sh
RUN chmod +x /app/entrypoint-nginx.sh

# Set production environment and expose HTTP and HTTPS ports
ENV NODE_ENV=production
EXPOSE 80 443

# Start supervisor to run both services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
