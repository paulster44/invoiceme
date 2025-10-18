import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET'];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var ${key}`);
  }
});

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  databaseProvider: process.env.DATABASE_PROVIDER ?? 'sqlite',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET!,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  reportBaseUrl: process.env.REPORT_BASE_URL ?? 'http://localhost:4000'
};
