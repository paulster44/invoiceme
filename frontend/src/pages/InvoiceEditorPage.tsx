import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { LineItem, LineItemTable } from '../components/LineItemTable';
import { MoneyInput } from '../components/MoneyInput';
import { TotalsCard } from '../components/TotalsCard';
import { saveDraft } from '../lib/db';

type InvoiceDraft = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  status: string;
  currency: string;
  discountPct: number;
  discountAmt: number;
  shippingAmt: number;
  taxConfig: Record<string, number>;
  notes: string;
};

const defaultInvoice: InvoiceDraft = {
  clientId: '',
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  status: 'Draft',
  currency: 'CAD',
  discountPct: 0,
  discountAmt: 0,
  shippingAmt: 0,
  taxConfig: { GST: 0.05, QST: 0.09975 },
  notes: ''
};

const computeTotals = (items: LineItem[], invoice: InvoiceDraft) => {
  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const discount = invoice.discountAmt || (invoice.discountPct ? subtotal * (invoice.discountPct / 100) : 0);
  const taxableBase = items
    .filter((item) => item.taxable)
    .reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const discountRatio = subtotal === 0 ? 0 : discount / subtotal;
  const taxableSubtotal = Math.max(0, taxableBase * (1 - discountRatio));
  const taxes = Object.entries(invoice.taxConfig).reduce((acc, [label, rate]) => {
    acc[label] = Number((taxableSubtotal * rate).toFixed(2));
    return acc;
  }, {} as Record<string, number>);
  const taxTotal = Object.values(taxes).reduce((acc, val) => acc + val, 0);
  const total = taxableSubtotal + taxTotal + (invoice.shippingAmt ?? 0);
  return { subtotal, discount, taxes, taxTotal, total };
};

export const InvoiceEditorPage = () => {
  const token = useAuthStore((state) => state.token)!;
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, taxable: true }
  ]);
  const [invoice, setInvoice] = useState<InvoiceDraft>(defaultInvoice);
  const [payments, setPayments] = useState<any[]>([]);
  const [recordPaymentMode, setRecordPaymentMode] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.clients(token)
  });

  const { data: invoiceData } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => (id ? api.invoice(token, id) : null),
    enabled: Boolean(id)
  });

  useEffect(() => {
    if (invoiceData) {
      const taxConfig = Object.entries(invoiceData.taxConfig ?? defaultInvoice.taxConfig)
        .filter(([, value]) => typeof value === 'number')
        .reduce<Record<string, number>>((acc, [key, value]) => {
          acc[key] = Number(value);
          return acc;
        }, {});

      setInvoice({
        clientId: invoiceData.clientId,
        issueDate: invoiceData.issueDate.slice(0, 10),
        dueDate: invoiceData.dueDate ? invoiceData.dueDate.slice(0, 10) : '',
        status: invoiceData.status,
        currency: invoiceData.currency,
        discountPct: invoiceData.discountPct ?? 0,
        discountAmt: invoiceData.discountAmt ?? 0,
        shippingAmt: invoiceData.shippingAmt ?? 0,
        taxConfig: Object.keys(taxConfig).length ? taxConfig : defaultInvoice.taxConfig,
        notes: invoiceData.notes ?? ''
      });
      setLineItems(
        invoiceData.items.map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxable: item.taxable
        }))
      );
      setPayments(invoiceData.payments ?? []);
    }
  }, [invoiceData]);

  const totals = useMemo(() => computeTotals(lineItems, invoice), [lineItems, invoice]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (id) {
        return api.updateInvoice(token, id, payload);
      }
      return api.createInvoice(token, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/invoices'] });
      if (!id) {
        navigate(`/invoices/${(data as any).id}`);
      } else {
        setMessage('Invoice saved');
      }
    },
    onError: async (err: any) => {
      if (err instanceof Error && err.message === 'offline-queued') {
        setMessage('Offline: invoice changes queued.');
        await saveDraft({
          id: id ?? `draft-${Date.now()}`,
          ...invoice,
          lineItems,
          message: 'Pending sync'
        });
      } else if (err instanceof Error && err.message.startsWith('conflict:')) {
        await saveDraft({
          id: `${id}-local-copy`,
          ...invoice,
          notes: `${invoice.notes ?? ''} (local copy)`,
          lineItems,
          message: 'Conflict detected (local copy)'
        });
        setMessage('Conflict detected. A local copy was saved.');
      } else {
        setMessage('Unable to save invoice.');
      }
    }
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...invoice,
      items: lineItems,
      shippingAmt: Number(invoice.shippingAmt),
      discountAmt: Number(invoice.discountAmt),
      discountPct: Number(invoice.discountPct)
    };
    mutation.mutate(payload);
  };

  const handleRecordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const method = form.get('method');
    const date = form.get('date');
    const notes = form.get('notes');
    try {
      await api.recordPayment(token, id, { amount, method, date, notes });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setRecordPaymentMode(false);
      setMessage('Payment recorded');
    } catch (error) {
      if (error instanceof Error && error.message === 'offline-queued') {
        setMessage('Offline: payment queued for sync.');
        setRecordPaymentMode(false);
      } else {
        setMessage('Unable to record payment right now.');
      }
    }
  };

  const downloadPdf = async () => {
    if (!id) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      setMessage('Unable to download PDF.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceData?.number ?? 'invoice'}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const emailInvoice = async () => {
    if (!id) return;
    try {
      await apiFetchWithToken(`/invoices/${id}/email`, token);
      setMessage('Simulated invoice email logged on server.');
    } catch (error) {
      setMessage('Unable to trigger email. Try again later.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{id ? 'Edit invoice' : 'New invoice'}</h1>
          <p className="text-sm text-slate-400">Fill out client details, line items, and taxes.</p>
        </div>
        {id && (
          <div className="flex gap-2">
            <button onClick={downloadPdf} className="rounded border border-slate-700 px-3 py-2 text-sm" type="button">
              Download PDF
            </button>
            <button onClick={emailInvoice} className="rounded border border-slate-700 px-3 py-2 text-sm" type="button">
              Email invoice
            </button>
          </div>
        )}
      </div>
      {message && <div className="rounded border border-emerald-600 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      <form className="grid gap-6 lg:grid-cols-[2fr_1fr]" onSubmit={handleSubmit}>
        <div className="space-y-6">
          <section className="rounded border border-slate-800 bg-slate-900 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Client
                <select
                  value={invoice.clientId}
                  onChange={(event) => setInvoice((prev) => ({ ...prev, clientId: event.target.value }))}
                  required
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                >
                  <option value="">Select client</option>
                  {(clients as any[])?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Status
                <select
                  value={invoice.status}
                  onChange={(event) => setInvoice((prev) => ({ ...prev, status: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                >
                  <option>Draft</option>
                  <option>Sent</option>
                  <option>Partially Paid</option>
                  <option>Paid</option>
                  <option>Overdue</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Issue date
                <input
                  type="date"
                  value={invoice.issueDate}
                  onChange={(event) => setInvoice((prev) => ({ ...prev, issueDate: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                />
              </label>
              <label className="text-sm text-slate-300">
                Due date
                <input
                  type="date"
                  value={invoice.dueDate}
                  onChange={(event) => setInvoice((prev) => ({ ...prev, dueDate: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                />
              </label>
            </div>
          </section>
          <section className="rounded border border-slate-800 bg-slate-900 p-4">
            <LineItemTable items={lineItems} onChange={setLineItems} />
          </section>
          <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-4">
            <MoneyInput
              label="Discount amount"
              value={Number(invoice.discountAmt) || 0}
              onChange={(value) => setInvoice((prev) => ({ ...prev, discountAmt: value }))}
            />
            <MoneyInput
              label="Discount %"
              value={Number(invoice.discountPct) || 0}
              onChange={(value) => setInvoice((prev) => ({ ...prev, discountPct: value }))}
            />
            <MoneyInput
              label="Shipping"
              value={Number(invoice.shippingAmt) || 0}
              onChange={(value) => setInvoice((prev) => ({ ...prev, shippingAmt: value }))}
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-200">Taxes</p>
              {Object.entries(invoice.taxConfig).map(([label, rate]) => (
                <label key={label} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <span className="text-slate-200">{label}</span>
                  <input
                    type="number"
                    step="0.001"
                    value={rate}
                    onChange={(event) =>
                      setInvoice((prev) => ({
                        ...prev,
                        taxConfig: { ...prev.taxConfig, [label]: Number(event.target.value) }
                      }))
                    }
                    className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right text-slate-50"
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  setInvoice((prev) => ({
                    ...prev,
                    taxConfig: { ...prev.taxConfig, [`Custom ${Object.keys(prev.taxConfig).length + 1}`]: 0.01 }
                  }))
                }
                className="text-sm text-brand"
              >
                Add tax rate
              </button>
            </div>
            <label className="block text-sm text-slate-300">
              Notes
              <textarea
                value={invoice.notes}
                onChange={(event) => setInvoice((prev) => ({ ...prev, notes: event.target.value }))}
                className="mt-1 h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
              />
            </label>
          </section>
        </div>
        <div className="space-y-4">
          <TotalsCard title="Totals">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Discounts</span>
              <span>-${totals.discount.toFixed(2)}</span>
            </div>
            {Object.entries(totals.taxes).map(([label, amount]) => (
              <div key={label} className="flex justify-between text-sm">
                <span>{label}</span>
                <span>${amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span>Shipping</span>
              <span>${(invoice.shippingAmt ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </TotalsCard>
          {payments.length > 0 && (
            <TotalsCard title="Payments">
              {payments.map((payment) => (
                <div key={payment.id} className="flex justify-between text-sm">
                  <span>{new Date(payment.date).toLocaleDateString()} · {payment.method}</span>
                  <span>${payment.amount.toFixed(2)}</span>
                </div>
              ))}
            </TotalsCard>
          )}
          <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
            <button
              type="submit"
              className="w-full rounded bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              {mutation.isPending ? 'Saving…' : 'Save invoice'}
            </button>
            {id && (
              <button
                type="button"
                onClick={() => setRecordPaymentMode((prev) => !prev)}
                className="w-full rounded border border-slate-700 px-3 py-2 text-sm"
              >
                {recordPaymentMode ? 'Cancel' : 'Record payment'}
              </button>
            )}
            {recordPaymentMode && id && (
              <form className="space-y-2" onSubmit={handleRecordPayment}>
                <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
                <label className="block text-sm text-slate-300">
                  Amount
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                  />
                </label>
                <select name="method" className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50">
                  <option value="cash">Cash</option>
                  <option value="etransfer">E-Transfer</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
                <textarea name="notes" placeholder="Notes" className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
                <button type="submit" className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                  Save payment
                </button>
              </form>
            )}
            <Link to="/invoices" className="block text-center text-sm text-slate-400">
              Back to list
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

const apiFetchWithToken = async (path: string, token: string) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? '/api'}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed request');
  return res.json();
};
