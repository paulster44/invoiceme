import { buildApp } from './app.js';
import { env } from './env.js';

const start = async () => {
  const app = await buildApp();
  try {
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
