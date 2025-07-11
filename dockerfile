# ────────────────────────────
# Walpurgisbot v2 – Bun build
# ────────────────────────────

##### ── Builder stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS builder
WORKDIR /app

# 1) Copy manifests. Copying bun.lock is crucial for a frozen install.
COPY package.json bun.lock tsconfig.json ./

# 2) Install dependencies using the lockfile. --frozen-lockfile is correct.
#    We remove the outdated --lockfile-format flag.
RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile

# 3) Bring in the rest of the source and build the single binary
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

# Create unprivileged user
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Mount for persistent data
VOLUME ["/app/data"]

# 1) Copy only the compiled binary from the builder stage.
#    The binary is self-contained; we don't need bun.lock or the cache.
COPY --from=builder /app/walpurgisbot-v2 .

# Set permissions and switch user
RUN chown -R appuser:appuser /app && \
    chmod +x /app/walpurgisbot-v2
USER appuser

# Entrypoint
CMD ["./walpurgisbot-v2"]