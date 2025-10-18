import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles.css';
import { useAuthStore } from './store/auth';
import { api } from './lib/api';
import { registerSW } from 'virtual:pwa-register';

const queryClient = new QueryClient();

const Root = () => {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);

  React.useEffect(() => {
    if (token) {
      api
        .me(token)
        .then((user) => setUser(user))
        .catch(() => setUser(null));
    }
  }, [token, setUser]);

  React.useEffect(() => {
    registerSW({ immediate: true });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
