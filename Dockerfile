# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

# cache-friendly layer: workspace descriptors first
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN pnpm install --frozen-lockfile

# now copy source
COPY . .

# build prisma client + apps (use path filters so it works even if names change)
RUN pnpm --filter ./backend prisma:generate
RUN pnpm --filter ./frontend build
RUN pnpm --filter ./backend build
RUN pnpm --filter ./backend deploy --prod /app/backend-deploy

# ---------- runtime ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# backend runtime
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend-deploy/node_modules ./node_modules
COPY --from=build /app/backend-deploy/package.json ./
COPY --from=build /app/backend-deploy/pnpm-lock.yaml ./pnpm-lock.yaml

# serve frontend statically from backend
COPY --from=build /app/frontend/dist ./public

EXPOSE 8080
CMD ["node", "dist/index.js"]
