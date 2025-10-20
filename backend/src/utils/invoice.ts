import type { Invoice, InvoiceItem, Payment } from '@prisma/client';

type TaxConfig = Record<string, number>;

export interface InvoiceComputation {
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  taxes: Record<string, number>;
  shipping: number;
  total: number;
  payments: number;
  balance: number;
}

const toCents = (value: number | null | undefined) => Math.round((value ?? 0) * 100);
const fromCents = (value: number) => value / 100;

export const computeInvoiceTotals = (
  invoice: Invoice & { items: InvoiceItem[]; payments: Payment[] },
  taxSettings: TaxConfig
): InvoiceComputation => {
  const subtotalCents = invoice.items.reduce((acc, item) => {
    return acc + Math.round(item.quantity * item.unitPrice * 100);
  }, 0);

  const discountAmt = invoice.discountAmt != null
    ? toCents(invoice.discountAmt)
    : invoice.discountPct != null
      ? Math.round(subtotalCents * (invoice.discountPct / 100))
      : 0;
  const taxableSubtotal = subtotalCents - discountAmt;

  const taxes: Record<string, number> = {};
  const enabledTaxes: TaxConfig = invoice.taxConfig as TaxConfig || {};
  Object.entries(enabledTaxes).forEach(([label, rate]) => {
    if (typeof rate === 'number') {
      taxes[label] = fromCents(Math.round(taxableSubtotal * rate));
    }
  });

  const taxTotalCents = Object.values(taxes).reduce((acc, val) => acc + Math.round(val * 100), 0);
  const shippingCents = toCents(invoice.shippingAmt);
  const totalCents = taxableSubtotal + taxTotalCents + shippingCents;
  const paymentsCents = invoice.payments.reduce((acc, payment) => acc + toCents(payment.amount), 0);
  const balanceCents = totalCents - paymentsCents;

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountAmt),
    taxableSubtotal: fromCents(taxableSubtotal),
    taxes,
    shipping: fromCents(shippingCents),
    total: fromCents(totalCents),
    payments: fromCents(paymentsCents),
    balance: fromCents(balanceCents)
  };
};

export const nextInvoiceNumber = async (userId: string, prisma: any, prefix: string) => {
  const latest = await prisma.invoice.findFirst({
    where: { userId, number: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' }
  });
  const current = latest?.number?.replace(prefix, '') ?? '0';
  const next = parseInt(current, 10) + 1;
  return `${prefix}${next.toString().padStart(4, '0')}`;
};

export const resolveStatus = (invoice: Invoice, totals: InvoiceComputation): string => {
  if (totals.balance <= 0) return 'Paid';
  if (totals.payments > 0) return 'Partially Paid';
  if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) return 'Overdue';
  return invoice.status ?? 'Draft';
};
