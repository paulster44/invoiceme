import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@invoice.test' },
    update: {},
    create: {
      email: 'demo@invoice.test',
      passwordHash,
      businessName: 'Demo Business',
      taxSettings: { GST: 0.05, QST: 0.09975, enabled: ['GST', 'QST'] }
    }
  });

  await prisma.payment.deleteMany({ where: { invoice: { userId: user.id } } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { userId: user.id } } });
  await prisma.invoice.deleteMany({ where: { userId: user.id } });
  await prisma.client.deleteMany({ where: { userId: user.id } });

  const clients = await Promise.all(
    ['Alice Smith', 'Bob Agency', 'Charlie Consulting'].map((name, index) =>
      prisma.client.create({
        data: {
          userId: user.id,
          name,
          company: index === 1 ? 'Agency Co' : undefined,
          email: `${name.split(' ')[0].toLowerCase()}@example.com`
        }
      })
    )
  );

  const taxes = { GST: 0.05, QST: 0.09975 };

  for (let i = 0; i < 5; i++) {
    const client = clients[i % clients.length];
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: client.id,
        number: `INV-${(i + 1).toString().padStart(4, '0')}`,
        issueDate: new Date(Date.now() - i * 86400000),
        dueDate: new Date(Date.now() + (5 - i) * 86400000),
        status: 'Sent',
        taxConfig: taxes,
        items: {
          create: [
            {
              description: `Consulting session ${i + 1}`,
              quantity: 2,
              unitPrice: 200,
              taxable: true
            },
            {
              description: 'Travel expenses',
              quantity: 1,
              unitPrice: 50,
              taxable: false
            }
          ]
        }
      },
      include: { payments: true, items: true }
    });

    if (i % 2 === 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: 150,
          date: new Date(),
          method: 'etransfer'
        }
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
