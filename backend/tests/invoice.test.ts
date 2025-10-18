import { describe, expect, it } from 'vitest';
import { computeInvoiceTotals } from '../src/utils/invoice.js';

const invoiceMock = {
  id: 'inv1',
  userId: 'user1',
  clientId: 'client1',
  number: 'INV-0001',
  issueDate: new Date(),
  dueDate: new Date(),
  status: 'Draft',
  currency: 'CAD',
  discountPct: null,
  discountAmt: 10,
  shippingAmt: 5,
  taxConfig: { GST: 0.05, QST: 0.09975 },
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    { id: 'item1', invoiceId: 'inv1', description: 'Service', quantity: 2, unitPrice: 100, taxable: true },
    { id: 'item2', invoiceId: 'inv1', description: 'Non-taxable', quantity: 1, unitPrice: 50, taxable: false }
  ],
  payments: [
    { id: 'pay1', invoiceId: 'inv1', date: new Date(), amount: 50, method: 'cash', notes: null }
  ]
} as any;

describe('computeInvoiceTotals', () => {
  it('calculates totals with taxes and payments', () => {
    const totals = computeInvoiceTotals(invoiceMock, invoiceMock.taxConfig);
    expect(totals.subtotal).toBeCloseTo(250);
    expect(totals.discount).toBeCloseTo(10);
    expect(totals.shipping).toBeCloseTo(5);
    const taxSum = Object.values(totals.taxes).reduce((acc, val) => acc + val, 0);
    expect(taxSum).toBeGreaterThan(0);
    expect(totals.total).toBeGreaterThan(totals.subtotal - totals.discount);
    expect(totals.payments).toBeCloseTo(50);
    expect(totals.balance).toBeCloseTo(totals.total - 50);
  });
});
