# ---------- Build stage ----------
#-----20251027a
FROM node:20-slim AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# --- Frontend ---
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN pnpm install --no-frozen-lockfile
COPY frontend ./
RUN pnpm build

# --- Backend ---
WORKDIR /app/backend
COPY backend/package.json ./
RUN pnpm install --no-frozen-lockfile
COPY backend ./
# Generate Prisma client
RUN [ -f "prisma/schema.prisma" ] && pnpm prisma generate || true
# Compile TypeScript
RUN pnpm build

# ---------- Runtime stage ----------
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy artifacts
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/prisma       ./backend/prisma
COPY --from=build /app/frontend/dist        ./public
# Copy *both* possible build locations to be safe
COPY --from=build /app/backend/dist         ./backend/dist
COPY --from=build /app/dist                 ./dist

EXPOSE 8080

# Print what's in the image, then try common entrypoints in order.
# This will show up in Cloud Run logs and immediately tell us which path exists.
CMD ["sh","-c", "\
  echo '--- LS /app ---' && ls -la /app && \
  echo '--- LS /app/backend ---' && ls -la /app/backend || true && \
  echo '--- LS /app/backend/dist ---' && ls -la /app/backend/dist || true && \
  echo '--- LS /app/dist ---' && ls -la /app/dist || true && \
  node backend/dist/index.js || \
  node dist/index.js || \
  node backend/dist/server.js || \
  node dist/server.js || \
  node backend/dist/app.js || \
  node dist/app.js \
"]
