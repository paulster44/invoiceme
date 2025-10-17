FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter backend prisma generate
RUN pnpm --filter frontend build
RUN pnpm --filter backend build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json backend/
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/backend/node_modules backend/node_modules
COPY --from=build /app/frontend/dist frontend/dist
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["pnpm", "--filter", "backend", "start"]
