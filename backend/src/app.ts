import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';

import { env } from './env.js';

// ⬇️ default imports (matches plugin default-exports below)
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';

import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import invoiceRoutes from './routes/invoices.js';
import meRoutes from './routes/me.js';
import reportRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Health check for Cloud Run
  app.get('/healthz', async () => ({ ok: true }));

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // Serve built frontend if present
  const staticCandidates = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(__dirname, '../../frontend/dist'),
  ];
  const staticRoot = staticCandidates.find((p) => fs.existsSync(p));
  if (staticRoot) {
    await app.register(fastifyStatic, { root: staticRoot, prefix: '/' });
    // SPA fallback
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.method === 'GET') reply.sendFile('index.html');
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
