import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';

import { env } from './env.js';
import prismaPlugin from './plugins/prisma.js'; // default export
import authPlugin from './plugins/auth.js';     // default export

import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import invoiceRoutes from './routes/invoices.js';
import meRoutes from './routes/me.js';
import reportRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Cheap health route first so Cloud Run startup probes pass
  app.get('/healthz', async () => ({ ok: true }));

  // Register plugins, but don't let failures crash container
  try {
    await app.register(prismaPlugin);
  } catch (err) {
    app.log.error({ err }, 'Prisma plugin failed to register. DB routes may fail.');
  }

  try {
    await app.register(authPlugin);
  } catch (err) {
    app.log.error({ err }, 'Auth plugin failed to register. Auth may fail.');
  }

  await app.register(cors, { origin: env.corsOrigin, credentials: true });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1'],
  });

  // Serve built frontend if present
  const staticRootCandidates = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(__dirname, '../../frontend/dist'),
  ];
  const staticRoot = staticRootCandidates.find((p) => fs.existsSync(p));
  if (staticRoot) {
    await app.register(fastifyStatic, { root: staticRoot, prefix: '/' });
    // SPA fallback
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.method === 'GET') reply.sendFile('index.html');
      else reply.code(404).send({ message: 'Not Found' });
    });
  }

  // API routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(meRoutes, { prefix: '/api' });
  await app.register(clientRoutes, { prefix: '/api' });
  await app.register(invoiceRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });

  return app;
}
