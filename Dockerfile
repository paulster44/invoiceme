# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

# --- Build frontend ---
WORKDIR /app/frontend
COPY frontend/package.json ./
# lockfile optional; install must not fail if it's missing
RUN pnpm install --no-frozen-lockfile
COPY frontend ./
RUN pnpm build

# --- Build backend ---
WORKDIR /app/backend
COPY backend/package.json ./
RUN pnpm install --no-frozen-lockfile
COPY backend ./
# If Prisma exists, generate client (ignore if not present)
RUN [ -f "prisma/schema.prisma" ] && pnpm prisma generate || true
RUN pnpm build

# ---------- runtime stage ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy backend runtime and public assets
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/frontend/dist ./public

EXPOSE 8080
CMD ["sh","-c","node dist/index.js || node dist/server.js || node dist/app.js"]
