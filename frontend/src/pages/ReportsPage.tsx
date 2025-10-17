import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateRangePicker } from '../components/DateRangePicker';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const formatRange = (range: { from: string; to: string }) =>
  `?from=${range.from}&to=${range.to}`;

export const ReportsPage = () => {
  const token = useAuthStore((state) => state.token)!;
  const [message, setMessage] = useState<string | null>(null);
  const [range, setRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    return { from, to };
  });

  const { data, refetch, isFetching } = useQuery({
    queryKey: ['reports', range.from, range.to],
    queryFn: () => api.reportsSummary(token, formatRange(range))
  });

  useEffect(() => {
    refetch();
  }, [range.from, range.to, refetch]);

  const totals = data?.summary ?? { subtotal: 0, discount: 0, taxes: {}, shipping: 0, total: 0, payments: 0, balance: 0, taxTotal: 0, netIncome: 0 };
  const rows = data?.rows ?? [];

  const download = async (type: 'csv' | 'pdf') => {
    try {
      const response = type === 'csv'
        ? await api.reportsCsv(token, formatRange(range))
        : await api.reportsPdf(token, formatRange(range));
      if (!response.ok) {
        throw new Error('export-failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = type === 'csv' ? 'tax-summary.csv' : 'tax-summary.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage('Unable to export right now. Try again when online.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tax & income reports</h1>
          <p className="text-sm text-slate-400">Export-ready summaries by date range.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => download('csv')} className="rounded border border-slate-700 px-3 py-2 text-sm" type="button">
            Export CSV
          </button>
          <button onClick={() => download('pdf')} className="rounded border border-slate-700 px-3 py-2 text-sm" type="button">
            Export PDF
          </button>
        </div>
      </div>
      <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      {message && <p className="text-sm text-amber-400">{message}</p>}
      {!navigator.onLine && <p className="text-sm text-amber-400">Offline: showing cached data.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Gross" value={totals.subtotal} />
        <SummaryCard title="Discounts" value={totals.discount} />
        <SummaryCard title="Net income" value={totals.netIncome} />
        {Object.entries(totals.taxes as Record<string, number>).map(([label, amount]) => (
          <SummaryCard key={label} title={`${label} collected`} value={amount} />
        ))}
        <SummaryCard title="Total" value={totals.total} />
        <SummaryCard title="Payments" value={totals.payments} />
        <SummaryCard title="Balance" value={totals.balance} />
      </div>
      <div className="overflow-auto rounded border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Invoice</th>
              <th className="px-4 py-2 text-left">Client</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-right">Taxes</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Payments</th>
              <th className="px-4 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm text-slate-100">
            {rows.map((row: any) => (
              <tr key={row.number}>
                <td className="px-4 py-2">{row.date}</td>
                <td className="px-4 py-2">{row.number}</td>
                <td className="px-4 py-2">{row.client}</td>
                <td className="px-4 py-2 text-right">${row.subtotal.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  {Object.entries(row.taxes)
                    .map(([label, amount]) => `${label} ${amount.toFixed(2)}`)
                    .join(', ')}
                </td>
                <td className="px-4 py-2 text-right">${row.total.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${row.payments.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${row.balance.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && !isFetching && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No invoices in this range yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value }: { title: string; value: number }) => (
  <div className="rounded border border-slate-800 bg-slate-900 p-4">
    <p className="text-xs uppercase text-slate-400">{title}</p>
    <p className="text-xl font-semibold text-white">${value.toFixed(2)}</p>
  </div>
);
