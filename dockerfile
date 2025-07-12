# ────────────────────────────
# Walpurgisbot v2 – JIT build
# ────────────────────────────

##### ── Dependencies stage ── #####
# First, install dependencies in a separate layer to leverage Docker's cache.
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS deps
WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --production


##### ── Runtime stage ── #####
# Start with a fresh Bun image for the final stage.
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine
WORKDIR /app

# Set all environment variables needed at RUNTIME.
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/walpurgis.db \
    MIGRATIONS_PATH=/app/src/database/migrations

# Copy the installed dependencies from the 'deps' stage.
COPY --from=deps /app/node_modules ./node_modules
# Copy the entire application source code.
COPY . .

RUN addgroup -S appuser && adduser -S appuser -G appuser
VOLUME ["/app/data"]
RUN chown -R appuser:appuser /app

USER appuser

# Run the application using Bun as the interpreter.
CMD ["bun", "run", "src/index.ts"]