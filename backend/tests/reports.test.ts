import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PROVIDER = 'sqlite';
process.env.DATABASE_URL = 'file:./tests/test.db';
process.env.JWT_SECRET = 'test-secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';

let prisma: PrismaClient;
let token: string;
let buildApp: typeof import('../src/app.js').buildApp;

beforeAll(async () => {
  const dbPath = path.resolve(process.cwd(), 'tests/test.db');
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }
  const migrationSql = fs.readFileSync(path.resolve(process.cwd(), 'prisma/migrations/0001_init/migration.sql'), 'utf-8');
  prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
  for (const statement of migrationSql.split(';')) {
    const trimmed = statement.trim();
    if (trimmed) {
      await prisma.$executeRawUnsafe(trimmed);
    }
  }

  const user = await prisma.user.create({
    data: {
      email: 'report@test.com',
      passwordHash: 'hash',
      businessName: 'Reports Inc.',
      taxSettings: { GST: 0.05, QST: 0.09975 }
    }
  });
  const client = await prisma.client.create({
    data: { userId: user.id, name: 'Client One' }
  });
  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client.id,
      number: 'INV-0001',
      issueDate: new Date('2024-01-05'),
      status: 'Sent',
      taxConfig: { GST: 0.05, QST: 0.09975 },
      items: {
        create: [{ description: 'Work', quantity: 1, unitPrice: 100, taxable: true }]
      }
    }
  });
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 25,
      date: new Date('2024-01-10'),
      method: 'cash'
    }
  });

  ({ buildApp } = await import('../src/app.js'));
  const app = await buildApp();
  token = app.jwt.sign({ id: user.id, email: user.email });
  await app.close();
});

afterAll(async () => {
  await prisma.$disconnect();
  const dbPath = path.resolve(process.cwd(), 'tests/test.db');
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }
});

describe('reports summary', () => {
  it('returns totals with taxes and net income', async () => {
    const { buildApp } = await import('../src/app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/summary?from=2024-01-01&to=2024-12-31',
      headers: { authorization: `Bearer ${token}` }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    expect(body.summary.subtotal).toBeGreaterThan(0);
    expect(body.summary.taxTotal).toBeGreaterThan(0);
    expect(body.summary.netIncome).toBeGreaterThan(0);
    expect(body.rows[0].taxes.GST).toBeGreaterThan(0);
    await app.close();
  });
});
