import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export const ClientsPage = () => {
  const token = useAuthStore((state) => state.token)!;
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [search, setSearch] = useState('');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.clients(token)
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (selectedClient) {
        await api.updateClient(token, selectedClient.id, payload);
      } else {
        await api.createClient(token, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setSelectedClient(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (selectedClient) {
        await api.deleteClient(token, selectedClient.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setSelectedClient(null);
    }
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      company: form.get('company'),
      email: form.get('email'),
      phone: form.get('phone'),
      address: form.get('address'),
      notes: form.get('notes')
    };
    mutation.mutate(payload);
  };

  const filtered = clients.filter((client: any) =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    (client.company ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Clients</h1>
            <p className="text-sm text-slate-400">Manage your customer directory.</p>
          </div>
          <button
            onClick={() => setSelectedClient(null)}
            className="rounded bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            New client
          </button>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search clients"
          className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-slate-50"
        />
        <div className="space-y-2">
          {filtered.map((client: any) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="w-full rounded border border-slate-800 bg-slate-900 p-4 text-left hover:border-brand"
            >
              <p className="font-semibold text-white">{client.name}</p>
              <p className="text-sm text-slate-400">{client.company ?? 'No company'} · {client.email ?? 'No email'}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-slate-400">No clients found.</p>}
        </div>
      </div>
      <aside className="rounded border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold text-white">{selectedClient ? 'Edit client' : 'Add client'}</h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300">
            Name
            <input
              name="name"
              defaultValue={selectedClient?.name ?? ''}
              required
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Company
            <input name="company" defaultValue={selectedClient?.company ?? ''} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
          </label>
          <label className="block text-sm text-slate-300">
            Email
            <input name="email" type="email" defaultValue={selectedClient?.email ?? ''} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
          </label>
          <label className="block text-sm text-slate-300">
            Phone
            <input name="phone" defaultValue={selectedClient?.phone ?? ''} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
          </label>
          <label className="block text-sm text-slate-300">
            Address
            <textarea name="address" defaultValue={selectedClient?.address ?? ''} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
          </label>
          <label className="block text-sm text-slate-300">
            Notes
            <textarea name="notes" defaultValue={selectedClient?.notes ?? ''} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50" />
          </label>
          <button type="submit" className="w-full rounded bg-brand px-3 py-2 text-sm font-semibold text-white">
            {mutation.isPending ? 'Saving…' : 'Save client'}
          </button>
          {selectedClient && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              className="w-full rounded border border-rose-600 px-3 py-2 text-sm text-rose-300"
            >
              {deleteMutation.isPending ? 'Removing…' : 'Delete client'}
            </button>
          )}
        </form>
      </aside>
    </div>
  );
};
