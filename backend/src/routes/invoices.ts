import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { computeInvoiceTotals, nextInvoiceNumber, resolveStatus } from '../utils/invoice.js';
import PdfPrinter from 'pdfmake';
import { env } from '../env.js';

const sanitize = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() : undefined);

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxable: z.boolean().default(true)
});

const normalizeTaxConfig = (input: any) =>
  Object.entries((input ?? {}) as Record<string, any>)
    .filter(([, value]) => typeof value === 'number' && !Number.isNaN(value))
    .reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = Number(value);
      return acc;
    }, {});

const invoiceSchema = z.object({
  clientId: z.string(),
  issueDate: z.string(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue']).optional(),
  currency: z.string().default('CAD'),
  discountPct: z.number().nullable().optional(),
  discountAmt: z.number().nullable().optional(),
  shippingAmt: z.number().nullable().optional(),
  taxConfig: z.record(z.number()).optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1)
});

const invoicesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const toResponse = async (invoiceId: string, userId: string) => {
    const invoice = await app.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: { items: true, payments: true, client: true, user: true }
    });
    if (!invoice) return null;
    const totals = computeInvoiceTotals(invoice, invoice.taxConfig as Record<string, number> ?? {});
    const status = resolveStatus(invoice, totals);
    if (status !== invoice.status) {
      await app.prisma.invoice.update({ where: { id: invoice.id }, data: { status } });
      invoice.status = status;
    }
    return {
      ...invoice,
      totals
    };
  };

  app.get('/invoices', async (request) => {
    const { status, clientId, from, to, search } = request.query as Record<string, string | undefined>;
    const invoices = await app.prisma.invoice.findMany({
      where: {
        userId: request.user.id,
        status: status ? status : undefined,
        clientId: clientId ?? undefined,
        issueDate: from || to ? {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined
        } : undefined,
        OR: search
          ? [
              { number: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: { items: true, payments: true, client: true, user: true },
      orderBy: { issueDate: 'desc' }
    });

    return Promise.all(
      invoices.map(async (inv) => {
        const totals = computeInvoiceTotals(inv, inv.taxConfig as Record<string, number> ?? {});
        const statusResolved = resolveStatus(inv, totals);
        if (statusResolved !== inv.status) {
          await app.prisma.invoice.update({ where: { id: inv.id }, data: { status: statusResolved } });
        }
        return {
          ...inv,
          status: statusResolved,
          totals
        };
      })
    );
  });

  app.post('/invoices', async (request, reply) => {
    const data = invoiceSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { id: request.user.id } });
    if (!user) {
      return reply.code(400).send({ message: 'User missing' });
    }
    const number = await nextInvoiceNumber(user.id, app.prisma, user.invoicePrefix);
    const baseTax = normalizeTaxConfig(user.taxSettings) || { GST: 0.05, QST: 0.09975 };
    const invoiceTax = Object.keys(data.taxConfig ?? {}).length ? normalizeTaxConfig(data.taxConfig) : baseTax;
    const created = await app.prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: data.clientId,
        number,
        issueDate: new Date(data.issueDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status ?? 'Draft',
        currency: data.currency ?? user.currency,
        discountPct: data.discountPct ?? null,
        discountAmt: data.discountAmt ?? null,
        shippingAmt: data.shippingAmt ?? null,
        taxConfig: invoiceTax,
        notes: sanitize(data.notes) ?? null,
        items: {
          create: data.items.map((item) => ({
            description: sanitize(item.description) ?? '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxable: item.taxable
          }))
        }
      },
      include: { items: true, payments: true, client: true, user: true }
    });
    const totals = computeInvoiceTotals(created, created.taxConfig as Record<string, number> ?? {});
    const statusResolved = resolveStatus(created, totals);
    if (statusResolved !== created.status) {
      await app.prisma.invoice.update({ where: { id: created.id }, data: { status: statusResolved } });
    }
    return { ...created, status: statusResolved, totals };
  });

  app.get('/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await toResponse(id, request.user.id);
    if (!invoice) return reply.code(404).send({ message: 'Invoice not found' });
    return invoice;
  });

  app.put('/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = invoiceSchema.partial().parse(request.body);
    const existing = await app.prisma.invoice.findFirst({ where: { id, userId: request.user.id }, include: { items: true } });
    if (!existing) return reply.code(404).send({ message: 'Invoice not found' });

    await app.prisma.invoice.update({
      where: { id },
      data: {
        clientId: data.clientId ?? existing.clientId,
        issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
        status: data.status ?? existing.status,
        currency: data.currency ?? existing.currency,
        discountPct: data.discountPct ?? existing.discountPct,
        discountAmt: data.discountAmt ?? existing.discountAmt,
        shippingAmt: data.shippingAmt ?? existing.shippingAmt,
        taxConfig: Object.keys(data.taxConfig ?? {}).length
          ? normalizeTaxConfig(data.taxConfig)
          : normalizeTaxConfig(existing.taxConfig),
        notes: sanitize(data.notes) ?? existing.notes,
        items: data.items
          ? {
              deleteMany: {},
              create: data.items.map((item) => ({
                description: sanitize(item.description) ?? '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxable: item.taxable
              }))
            }
          : undefined
      }
    });
    const invoice = await toResponse(id, request.user.id);
    if (!invoice) return reply.code(404).send({ message: 'Invoice not found' });
    return invoice;
  });

  app.delete('/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await app.prisma.invoice.findFirst({ where: { id, userId: request.user.id } });
    if (!existing) return reply.code(404).send({ message: 'Invoice not found' });
    await app.prisma.invoice.delete({ where: { id } });
    reply.code(204).send();
  });

  app.post('/invoices/:id/payments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        date: z.string(),
        amount: z.number().positive(),
        method: z.enum(['cash', 'etransfer', 'card', 'other']),
        notes: z.string().optional()
      })
      .parse(request.body);

    const invoice = await app.prisma.invoice.findFirst({ where: { id, userId: request.user.id } });
    if (!invoice) return reply.code(404).send({ message: 'Invoice not found' });
    const payment = await app.prisma.payment.create({
      data: {
        invoiceId: id,
        date: new Date(body.date),
        amount: body.amount,
        method: body.method,
        notes: sanitize(body.notes) ?? null
      }
    });
    return payment;
  });

  app.delete('/payments/:paymentId', async (request, reply) => {
    const { paymentId } = request.params as { paymentId: string };
    const existing = await app.prisma.payment.findFirst({
      where: { id: paymentId, invoice: { userId: request.user.id } }
    });
    if (!existing) return reply.code(404).send({ message: 'Payment not found' });
    await app.prisma.payment.delete({ where: { id: paymentId } });
    reply.code(204).send();
  });

  app.get('/invoices/:id/pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await toResponse(id, request.user.id);
    if (!invoice) return reply.code(404).send({ message: 'Invoice not found' });

    const fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    } as const;

    const printer = new PdfPrinter(fonts as any);
    const vfsFonts = await import('pdfmake/build/vfs_fonts.js');
    const vfs = (vfsFonts as any).pdfMake?.vfs ?? (vfsFonts as any).default?.pdfMake?.vfs;
    if (vfs) {
      (printer as any).vfs = vfs;
    }
    const itemsTable = [
      ['Description', 'Qty', 'Unit Price', 'Total'],
      ...invoice.items.map((item) => [
        item.description,
        item.quantity.toString(),
        item.unitPrice.toFixed(2),
        (item.quantity * item.unitPrice).toFixed(2)
      ])
    ];

    const taxes = Object.entries(invoice.totals.taxes).map(
      ([label, amount]) => `${label}: $${Number(amount as any).toFixed(2)}`
    );

    const docDefinition = {
      content: [
        { text: invoice.user.businessName ?? 'Invoice', style: 'header' },
        { text: `Invoice #${invoice.number}` },
        { text: `Issue Date: ${new Date(invoice.issueDate).toDateString()}` },
        { text: `Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toDateString() : 'N/A'}` },
        { text: `Client: ${invoice.client.name}` },
        { text: 'Items', style: 'subheader' },
        { table: { body: itemsTable } },
        { text: 'Totals', style: 'subheader', margin: [0, 20, 0, 0] },
        { ul: [
          `Subtotal: $${Number(invoice.totals.subtotal as any).toFixed(2)}`,
          `Discount: $${Number(invoice.totals.discount as any).toFixed(2)}`,
          ...taxes,
          `Shipping: $${Number(invoice.totals.shipping as any).toFixed(2)}`,
          `Total: $${Number(invoice.totals.total as any).toFixed(2)}`,
          `Payments: $${Number(invoice.totals.payments as any).toFixed(2)}`,
          `Balance: $${Number(invoice.totals.balance as any).toFixed(2)}`
        ] }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition as any);
    const chunks: Buffer[] = [];
    return await new Promise<void>((resolve) => {
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
        reply.send(buffer);
        resolve();
      });
      pdfDoc.end();
    });
  });

  app.post('/invoices/:id/email', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await toResponse(id, request.user.id);
    if (!invoice) return reply.code(404).send({ message: 'Invoice not found' });
    app.log.info({
      action: 'email-invoice',
      to: invoice.client.email,
      invoice: invoice.number,
      link: `${env.reportBaseUrl}/api/invoices/${invoice.id}/pdf`
    }, 'Simulated invoice email');
    return { message: 'Email queued (simulated)' };
  });
};

export default invoicesRoutes;
