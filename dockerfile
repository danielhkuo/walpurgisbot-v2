# ────────────────────────────
# Walpurgisbot v2 – Bun build
# ────────────────────────────

##### ── Builder stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS builder
WORKDIR /app

# Copy manifests first so dependency layers can be cached
COPY package.json bun.lockb tsconfig.json ./

# Use a BuildKit cache mount and lock-file enforcement
RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile

# Bring in the rest of the source and compile to a single binary
COPY . .
RUN bun build ./src/index.ts \
    --compile \
    --outfile /app/walpurgisbot-v2

##### ── Runtime stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/walpurgis.db
RUN addgroup -S appuser && adduser -S appuser -G appuser
VOLUME ["/app/data"]
COPY --from=builder /app/walpurgisbot-v2 .
RUN chown appuser:appuser /app/walpurgisbot-v2 && \
    chmod +x /app/walpurgisbot-v2
USER appuser
CMD ["./walpurgisbot-v2"]
