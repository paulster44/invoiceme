# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

# Build frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY frontend ./
RUN pnpm build

# Build backend
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY backend ./
# If Prisma exists, generate client (ignore if prisma not present)
RUN [ -f "prisma/schema.prisma" ] && pnpm prisma generate || true
RUN pnpm build

# ---------- runtime stage ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy backend runtime
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
# Prisma schema (if present)
COPY --from=build /app/backend/prisma ./prisma
# Static assets from frontend build
COPY --from=build /app/frontend/dist ./public

EXPOSE 8080
CMD ["node","dist/index.js"]
