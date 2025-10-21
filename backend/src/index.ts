import { buildApp } from './app.js';

const port = Number(process.env.PORT || 8080);
const host = '0.0.0.0';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port, host });
    // eslint-disable-next-line no-console
    console.log(`API listening on http://${host}:${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

void start();
