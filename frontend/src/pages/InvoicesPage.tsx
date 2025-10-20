import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { loadDrafts } from '../lib/db';

const statuses = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue'];

export const InvoicesPage = () => {
  const token = useAuthStore((state) => state.token)!;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const search = params.get('search') ?? '';

  const queryKey = ['/invoices', status, search];
  const searchParams = new URLSearchParams();
  if (status) searchParams.set('status', status);
  if (search) searchParams.set('search', search);
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.invoices(token, queryString)
  });

  const invoices = (data as any[]) ?? [];
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    loadDrafts().then(setDrafts);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Invoices</h1>
          <p className="text-sm text-slate-400">Track drafts, sent invoices, and payments.</p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark"
        >
          New invoice
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded border border-slate-800 bg-slate-900 p-4">
        <label className="text-sm text-slate-300">
          Status
          <select
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
            value={status}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) {
                next.set('status', event.target.value);
              } else {
                next.delete('status');
              }
              setParams(next, { replace: true });
            }}
          >
            <option value="">All</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Search
          <input
            className="mt-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
            value={search}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) {
                next.set('search', event.target.value);
              } else {
                next.delete('search');
              }
              setParams(next, { replace: true });
            }}
            placeholder="Invoice # or notes"
          />
        </label>
        {!navigator.onLine && <span className="text-sm text-amber-400">Offline: showing cached invoices.</span>}
      </div>
      {isLoading && <p>Loading invoices...</p>}
      {error && <p className="text-rose-400">Unable to load invoices.</p>}
      {drafts.length > 0 && (
        <div className="rounded border border-amber-600 bg-amber-900/20 p-4">
          <h2 className="text-sm font-semibold text-amber-200">Offline drafts</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {drafts.map((draft) => (
              <li key={draft.id}>{draft.notes || 'Draft'} · {draft.issueDate}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        {invoices.map((invoice) => (
          <Link
            key={invoice.id}
            to={`/invoices/${invoice.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900 p-4 hover:border-brand"
          >
            <div>
              <p className="text-sm font-semibold text-white">{invoice.number}</p>
              <p className="text-xs text-slate-400">{invoice.client?.name ?? 'Unknown client'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">{invoice.totals?.total?.toFixed(2) ?? '0.00'} {invoice.currency}</p>
              <p className="text-xs text-slate-500">
                {invoice.status} · Issued {format(new Date(invoice.issueDate), 'PP')}
              </p>
            </div>
          </Link>
        ))}
        {invoices.length === 0 && !isLoading && <p className="text-sm text-slate-400">No invoices yet. Create your first invoice.</p>}
      </div>
    </div>
  );
};
