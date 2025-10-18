import { ReactNode } from 'react';

export const TotalsCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow">
    <h3 className="text-sm font-semibold uppercase text-slate-400">{title}</h3>
    <div className="mt-2 space-y-2 text-slate-50">{children}</div>
  </div>
);
