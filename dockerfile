# ────────────────────────────
# Walpurgisbot v2 – Bun build
# ────────────────────────────

##### ── Builder stage ── #####
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS builder
WORKDIR /app

# 1) Copy only the static manifests so this layer is cache-stable
COPY package.json tsconfig.json ./

# 2) Install dependencies and force a binary lockfile
RUN --mount=type=cache,target=/root/.bun \
    bun install --lockfile-format=binary --frozen-lockfile

# 3) Snapshot the generated binary lockfile for later stages
RUN mkdir -p /lockfiles && cp bun.lockb /lockfiles/bun.lockb

# 4) Bring in the rest of the source and build the single binary
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

# 1) Copy in the lockfile and cached bun modules (optional, if your app reads bun.lockb at runtime)
COPY --from=builder /lockfiles/bun.lockb bun.lockb
COPY --from=builder /root/.bun /root/.bun

# 2) Copy the compiled binary
COPY --from=builder /app/walpurgisbot-v2 .

# Set permissions and switch user
RUN chown appuser:appuser /app/walpurgisbot-v2 && \
    chmod +x /app/walpurgisbot-v2
USER appuser

# Entrypoint
CMD ["./walpurgisbot-v2"]
