# ---------- Build stage (Debian) ----------
FROM node:20-slim AS build
WORKDIR /app

# Use pnpm
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

# Generate Prisma client (now built for Debian / OpenSSL 3.x)
RUN [ -f "prisma/schema.prisma" ] && pnpm prisma generate || true

# Type-check / compile TS
RUN pnpm build


# ---------- Runtime stage (Debian) ----------
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy only what we need at runtime
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/frontend/dist ./public

# Cloud Run expects the container to listen on $PORT
EXPOSE 8080

# Start the compiled backend
CMD ["node", "dist/index.js"]
