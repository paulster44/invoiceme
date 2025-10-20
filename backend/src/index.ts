import app from './app';

const port = Number(process.env.PORT) || 8080;
const host = '0.0.0.0';

// very cheap health route (no DB)
app.get('/healthz', async () => ({ ok: true }));

app.listen({ port, host })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://${host}:${port}`);
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
