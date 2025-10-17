import { cacheGet, cacheSet } from './db';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiOptions {
  method?: Method;
  body?: any;
  token?: string | null;
  cacheKey?: string;
  offlineFallback?: boolean;
}

export const apiFetch = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', body, token, cacheKey = path, offlineFallback = true } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (!navigator.onLine && method === 'GET' && offlineFallback) {
    const cached = await cacheGet<T>(cacheKey);
    if (cached) return cached;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    if (!navigator.onLine && method !== 'GET') {
      throw new Error('offline-queued');
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 409) {
      const conflict = await response.json().catch(() => ({}));
      throw new Error(`conflict:${JSON.stringify(conflict)}`);
    }
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json')
    ? await response.json()
    : ((await response.text()) as unknown as T);

  if (method === 'GET' && offlineFallback) {
    await cacheSet(cacheKey, data);
  }

  return data as T;
};

export const api = {
  register: (payload: { email: string; password: string }) => apiFetch<{ token: string }>('/auth/register', { method: 'POST', body: payload }),
  login: (payload: { email: string; password: string }) => apiFetch<{ token: string }>('/auth/login', { method: 'POST', body: payload }),
  me: (token: string) => apiFetch('/me', { token }),
  updateSettings: (token: string, body: any) => apiFetch('/settings', { method: 'PUT', token, body }),
  clients: (token: string) => apiFetch('/clients', { token }),
  createClient: (token: string, body: any) => apiFetch('/clients', { method: 'POST', token, body }),
  updateClient: (token: string, id: string, body: any) => apiFetch(`/clients/${id}`, { method: 'PUT', token, body }),
  deleteClient: (token: string, id: string) => apiFetch(`/clients/${id}`, { method: 'DELETE', token }),
  invoices: (token: string, params: string) => apiFetch(`/invoices${params}`, { token, cacheKey: `/invoices${params}` }),
  invoice: (token: string, id: string) => apiFetch(`/invoices/${id}`, { token }),
  createInvoice: (token: string, body: any) => apiFetch('/invoices', { method: 'POST', token, body }),
  updateInvoice: (token: string, id: string, body: any) => apiFetch(`/invoices/${id}`, { method: 'PUT', token, body }),
  deleteInvoice: (token: string, id: string) => apiFetch(`/invoices/${id}`, { method: 'DELETE', token }),
  recordPayment: (token: string, id: string, body: any) => apiFetch(`/invoices/${id}/payments`, { method: 'POST', token, body }),
  deletePayment: (token: string, id: string) => apiFetch(`/payments/${id}`, { method: 'DELETE', token }),
  reportsSummary: (token: string, query: string) => apiFetch(`/reports/summary${query}`, { token }),
  reportsCsv: (token: string, query: string) => fetch(`${API_URL}/reports/summary.csv${query}`, { headers: { Authorization: `Bearer ${token}` } }),
  reportsPdf: (token: string, query: string) => fetch(`${API_URL}/reports/summary.pdf${query}`, { headers: { Authorization: `Bearer ${token}` } })
};
