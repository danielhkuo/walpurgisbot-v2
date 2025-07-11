# ────────────────────────────
# Walpurgisbot v2 – Bun build
# ────────────────────────────

##### ── Builder stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS builder
WORKDIR /app

# --- FIX: Set NODE_ENV for the build ---
# This ensures Bun.env.NODE_ENV is 'production' when the compiler runs.
ENV NODE_ENV=production

# 1) Copy manifests.
COPY package.json bun.lock tsconfig.json ./

# 2) Install dependencies.
RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile --production
    # The --production flag is good practice; it skips devDependencies

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

# Create unprivileged user
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Mount for persistent data
VOLUME ["/app/data"]

# Copy only the compiled binary from the builder stage.
COPY --from=builder /app/walpurgisbot-v2 .

# Set permissions and switch user
RUN chown -R appuser:appuser /app && \
    chmod +x /app/walpurgisbot-v2
USER appuser

# Entrypoint
CMD ["./walpurgisbot-v2"]