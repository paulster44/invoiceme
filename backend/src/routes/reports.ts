import { FastifyPluginAsync } from 'fastify';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { computeInvoiceTotals } from '../utils/invoice.js';
import { stringify } from 'csv-stringify/sync';
import PdfPrinter from 'pdfmake';

const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const fetchData = async (userId: string, from?: string, to?: string) => {
    const invoices = await app.prisma.invoice.findMany({
      where: {
        userId,
        issueDate:
          from || to
            ? {
                gte: from ? startOfDay(parseISO(from)) : undefined,
                lte: to ? endOfDay(parseISO(to)) : undefined
              }
            : undefined
      },
      include: { items: true, payments: true, client: true }
    });

    const rows = invoices.map((invoice) => {
      const totals = computeInvoiceTotals(
        invoice,
        (invoice.taxConfig as Record<string, number>) ?? {}
      );
      return {
        date: invoice.issueDate.toISOString().split('T')[0],
        number: invoice.number,
        client: invoice.client.name,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxes: totals.taxes,
        shipping: totals.shipping,
        total: totals.total,
        payments: totals.payments,
        balance: totals.balance
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.subtotal += row.subtotal;
        acc.discount += row.discount;
        acc.shipping += row.shipping;
        Object.entries(row.taxes).forEach(([label, amount]) => {
          acc.taxes[label] = (acc.taxes[label] ?? 0) + Number((amount as unknown as number) ?? 0);
        });
        acc.total += Number(row.total as unknown as number);
        acc.payments += Number(row.payments as unknown as number);
        acc.balance += Number(row.balance as unknown as number);
        return acc;
      },
      {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        taxes: {} as Record<string, number>,
        total: 0,
        payments: 0,
        balance: 0
      }
    );

    const taxTotal = Object.values(summary.taxes).reduce(
      (acc, amount) => acc + Number((amount as unknown as number) ?? 0),
      0
    );
    const netIncome = summary.total - taxTotal;

    return { rows, summary: { ...summary, taxTotal, netIncome } };
  };

  app.get('/reports/summary', async (request) => {
    const { from, to } = request.query as Record<string, string | undefined>;
    return fetchData(request.user.id, from, to);
  });

  app.get('/reports/summary.csv', async (request, reply) => {
    const { from, to } = request.query as Record<string, string | undefined>;
    const { rows, summary } = await fetchData(request.user.id, from, to);

    const taxLabels = Object.keys(summary.taxes);
    const tax1 = taxLabels[0] ?? 'GST';
    const tax2 = taxLabels[1] ?? 'QST';

    const header = [
      'date',
      'invoice',
      'client',
      'subtotal',
      'tax_1_label',
      'tax_1_amount',
      'tax_2_label',
      'tax_2_amount',
      'total',
      'payments',
      'balance'
    ];

    const csvRows = rows.map((row) => [
      row.date,
      row.number,
      row.client,
      Number(row.subtotal as unknown as number).toFixed(2),
      tax1,
      Number((row.taxes[tax1] as unknown as number) ?? 0).toFixed(2),
      tax2,
      Number((row.taxes[tax2] as unknown as number) ?? 0).toFixed(2),
      Number(row.total as unknown as number).toFixed(2),
      Number(row.payments as unknown as number).toFixed(2),
      Number(row.balance as unknown as number).toFixed(2)
    ]);

    const csv = stringify([header, ...csvRows]);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="summary.csv"');
    return reply.send(csv);
  });

  app.get('/reports/summary.pdf', async (request, reply) => {
    const { from, to } = request.query as Record<string, string | undefined>;
    const { rows, summary } = await fetchData(request.user.id, from, to);

    // pdfmake setup (fonts + VFS)
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

    const body = [
      ['Date', 'Invoice', 'Client', 'Subtotal', 'Discount', 'Shipping', 'Taxes', 'Total', 'Payments', 'Balance'],
      ...rows.map((row) => [
        row.date,
        row.number,
        row.client,
        `$${Number(row.subtotal as unknown as number).toFixed(2)}`,
        `$${Number(row.discount as unknown as number).toFixed(2)}`,
        `$${Number(row.shipping as unknown as number).toFixed(2)}`,
        Object.entries(row.taxes)
          .map(([label, amount]) => `${label}: $${Number(amount as unknown as number).toFixed(2)}`)
          .join('\n'),
        `$${Number(row.total as unknown as number).toFixed(2)}`,
        `$${Number(row.payments as unknown as number).toFixed(2)}`,
        `$${Number(row.balance as unknown as number).toFixed(2)}`
      ])
    ];

    const docDefinition = {
      content: [
        { text: 'Tax Summary', style: 'header' },
        { text: `Range: ${from ?? 'start'} - ${to ?? 'end'}`, margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body
          }
        },
        { text: 'Totals', style: 'subheader', margin: [0, 20, 0, 0] },
        {
          ul: [
            `Subtotal: $${Number(summary.subtotal as unknown as number).toFixed(2)}`,
            `Discount: $${Number(summary.discount as unknown as number).toFixed(2)}`,
            ...Object.entries(summary.taxes).map(
              ([label, amount]) => `${label}: $${Number(amount as unknown as number).toFixed(2)}`
            ),
            `Shipping: $${Number(summary.shipping as unknown as number).toFixed(2)}`,
            `Total: $${Number(summary.total as unknown as number).toFixed(2)}`,
            `Tax Total: $${Number(summary.taxTotal as unknown as number).toFixed(2)}`,
            `Net Income: $${Number(summary.netIncome as unknown as number).toFixed(2)}`,
            `Payments: $${Number(summary.payments as unknown as number).toFixed(2)}`,
            `Balance: $${Number(summary.balance as unknown as number).toFixed(2)}`
          ]
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition as any);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      pdfDoc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', 'attachment; filename="summary.pdf"');
        reply.send(buffer);
        resolve();
      });

      pdfDoc.on('error', (err: unknown) => {
        request.log.error({ err }, 'pdf generation failed');
        reject(err);
      });

      pdfDoc.end();
    });
  });
};

export default reportsRoutes;
