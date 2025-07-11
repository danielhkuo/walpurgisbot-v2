# ────────────────────────────
# Walpurgisbot v2 – Bun build
# ────────────────────────────

##### ── Builder stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS builder
WORKDIR /app

# --- FIX: Define NODE_ENV using an ARG for CI/CD ---
# Define a build argument with a default value of 'production'.
ARG NODE_ENV=production
# Set the environment variable from the build argument.
ENV NODE_ENV=${NODE_ENV}

# 1) Copy manifests.
COPY package.json bun.lock tsconfig.json ./

# 2) Install dependencies.
RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile --production

# 3) Bring in the rest of the source and build the single binary
COPY . .
RUN bun build ./src/index.ts \
    --compile \
    --outfile /app/walpurgisbot-v2


##### ── Runtime stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} alpine:3.20

RUN apk add --no-cache ca-certificates libstdc++

WORKDIR /app

# This is still important for runtime configuration (e.g., TOKEN)
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/walpurgis.db

# ... (rest of the file is correct) ...
RUN addgroup -S appuser && adduser -S appuser -G appuser
VOLUME ["/app/data"]
COPY --from=builder /app/walpurgisbot-v2 .
RUN chown -R appuser:appuser /app && \
    chmod +x /app/walpurgisbot-v2
USER appuser
CMD ["./walpurgisbot-v2"]