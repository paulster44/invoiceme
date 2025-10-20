import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export const LoginPage = () => {
  const setToken = useAuthStore((state) => state.setToken);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.login({ email, password });
      setToken(token);
      navigate('/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-semibold text-white">Welcome back</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 focus:border-brand focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 focus:border-brand focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand px-3 py-2 font-semibold text-white shadow hover:bg-brand-dark"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          New here?{' '}
          <Link to="/register" className="text-brand">
            Create an account
          </Link>
        </p>
      </div>
      {!navigator.onLine && <p className="text-center text-sm text-amber-400">Offline mode: login requires connectivity.</p>}
    </div>
  );
};
