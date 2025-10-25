// backend/src/plugins/prisma.ts
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// NOTE: Do NOT force a DB connection during startup.
// Cloud Run must be able to boot and listen on $PORT even if DB is down.
// Prisma reads DATABASE_URL from process.env internally. We just avoid $connect()
// here so a missing/invalid URL doesn't crash the process at boot.
const prismaPlugin: FastifyPluginAsync = fp(async (app) => {
  if (!env.DATABASE_URL) {
    app.log.error('DATABASE_URL is not set. The API will start, but any DB call will fail.');
  }

  const prisma = new PrismaClient({
    // safer defaults in serverless; optional:
    log: ['error', 'warn'],
  });

  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    try {
      await prisma.$disconnect();
    } catch (err) {
      app.log.error({ err }, 'Failed to disconnect Prisma');
    }
  });
});

export default prismaPlugin;
