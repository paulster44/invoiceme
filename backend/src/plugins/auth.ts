// backend/src/plugins/auth.ts
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = fp(async (app) => {
  const secret = env.JWT_SECRET;
  if (!secret) {
    app.log.error('JWT_SECRET is not set');
    throw new Error('JWT_SECRET is required');
  }

  await app.register(fastifyJwt, { secret });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: 'Unauthorized' });
    }
  });
});

export default authPlugin;
