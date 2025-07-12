# ────────────────────────────
# Walpurgisbot v2 – JIT build
# ────────────────────────────

#################  Dependencies  #################
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine AS deps
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --production


#####################  Runtime  ###################
FROM --platform=${TARGETPLATFORM:-linux/amd64} oven/bun:1.2.17-alpine
WORKDIR /app

##### Runtime envs (compile-time defaults) #####
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/walpurgis.db \
    MIGRATIONS_PATH=/migrations

##### Files ######################################
# deps
COPY --from=deps /app/node_modules ./node_modules
# app source
COPY . .
# bundle *only* the migration SQL files into /migrations
COPY src/database/migrations /migrations

##### User & data dir ############################
RUN addgroup -S appuser && adduser -S appuser -G appuser
VOLUME ["/app/data"]
RUN chown -R appuser:appuser /app /migrations
USER appuser

##### Entrypoint #################################
CMD ["bun", "run", "src/index.ts"]