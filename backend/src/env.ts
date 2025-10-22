// backend/src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('production'),
  PORT: z.string().optional(),                 // Cloud Run sets this
  DATABASE_URL: z.string().url().optional(),   // optional at boot
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),        // safe default
  REPORT_BASE_URL: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Do NOT throw — log and continue so the server can start and show /healthz
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten());
}

export const env = {
  ...((parsed.success ? parsed.data : {}) as z.infer<typeof EnvSchema>),
  // normalize types
  port: Number(process.env.PORT ?? 8080),
  corsOrigin: (process.env.CORS_ORIGIN ?? '*')
};

// helpful boot-time warnings (once)
if (!env.JWT_SECRET) console.warn('[env] JWT_SECRET is not set. Auth will fail.');
if (!env.DATABASE_URL) console.warn('[env] DATABASE_URL is not set. Prisma routes will fail.');
if (!env.REPORT_BASE_URL) console.warn('[env] REPORT_BASE_URL not set. Email links will be generic.');
