import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { env } from './env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import invoiceRoutes from './routes/invoices.js';
import meRoutes from './routes/me.js';
import reportRoutes from './routes/reports.js';

export const buildApp = async () => {
  const app = Fastify({ logger: true });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1']
  });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/' 
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.method === 'GET') {
        reply.sendFile('index.html');
      } else {
        reply.code(404).send({ message: 'Not Found' });
      }
    });
  }

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(meRoutes, { prefix: '/api' });
  await app.register(clientRoutes, { prefix: '/api' });
  await app.register(invoiceRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });

  return app;
};
