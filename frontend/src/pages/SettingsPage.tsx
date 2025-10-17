import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const currencies = ['CAD', 'USD', 'EUR'];

export const SettingsPage = () => {
  const token = useAuthStore((state) => state.token)!;
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [logo, setLogo] = useState<string | null>(() => localStorage.getItem('business-logo'));
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: user?.businessName ?? '',
    invoicePrefix: user?.invoicePrefix ?? 'INV-',
    currency: user?.currency ?? 'CAD',
    taxSettings: user?.taxSettings ?? { GST: 0.05, QST: 0.09975, enabled: ['GST', 'QST'] }
  });

  useEffect(() => {
    if (user) {
      setForm({
        businessName: user.businessName ?? '',
        invoicePrefix: user.invoicePrefix ?? 'INV-',
        currency: user.currency ?? 'CAD',
        taxSettings: user.taxSettings ?? { GST: 0.05, QST: 0.09975, enabled: ['GST', 'QST'] }
      });
    }
  }, [user]);

  const handleTaxToggle = (label: string) => {
    const enabled = new Set(form.taxSettings.enabled ?? []);
    if (enabled.has(label)) {
      enabled.delete(label);
    } else {
      enabled.add(label);
    }
    setForm((prev) => ({
      ...prev,
      taxSettings: { ...prev.taxSettings, enabled: Array.from(enabled) }
    }));
  };

  const handleTaxRateChange = (label: string, rate: number) => {
    setForm((prev) => ({
      ...prev,
      taxSettings: { ...prev.taxSettings, [label]: rate }
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      businessName: form.businessName,
      invoicePrefix: form.invoicePrefix,
      currency: form.currency,
      taxSettings: form.taxSettings,
      logo
    };
    const updated = await api.updateSettings(token, payload);
    setUser(updated);
    setMessage('Settings saved');
  };

  const handleLogoChange = (event: FormEvent<HTMLInputElement>) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogo(dataUrl);
        localStorage.setItem('business-logo', dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Workspace settings</h1>
        <p className="text-sm text-slate-400">Manage business info, numbering, and taxes.</p>
      </div>
      {message && <div className="rounded border border-emerald-600 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm text-slate-300">
          Business name
          <input
            value={form.businessName}
            onChange={(event) => setForm((prev) => ({ ...prev, businessName: event.target.value }))}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Invoice prefix
          <input
            value={form.invoicePrefix}
            onChange={(event) => setForm((prev) => ({ ...prev, invoicePrefix: event.target.value }))}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Default currency
          <select
            value={form.currency}
            onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
          >
            {currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Taxes</h2>
          <div className="mt-3 space-y-3">
            {['GST', 'QST'].map((label) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.taxSettings.enabled?.includes(label)}
                    onChange={() => handleTaxToggle(label)}
                  />
                  {label}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={form.taxSettings[label] ?? 0}
                  onChange={(event) => handleTaxRateChange(label, Number(event.target.value))}
                  className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-slate-50"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Branding</h2>
          <input type="file" accept="image/*" onChange={handleLogoChange} className="mt-2 text-sm text-slate-300" />
          {logo && <img src={logo} alt="Logo" className="mt-3 h-20 rounded border border-slate-700 bg-white object-contain p-2" />}
        </div>
        <button type="submit" className="rounded bg-brand px-3 py-2 text-sm font-semibold text-white">
          Save settings
        </button>
      </form>
    </div>
  );
};
