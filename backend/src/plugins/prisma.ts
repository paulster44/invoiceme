import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL!
    }
  }
});

export type Prisma = typeof prisma;

declare module 'fastify' {
  interface FastifyInstance {
    prisma: Prisma;
  }
}

export default fp(async (app) => {
  await prisma.$connect();
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
