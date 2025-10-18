import { create } from 'zustand';

type AuthState = {
  token: string | null;
  user: any | null;
  setToken: (token: string | null) => void;
  setUser: (user: any | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('bb-token') : null,
  user: null,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('bb-token', token);
    } else {
      localStorage.removeItem('bb-token');
    }
    set({ token });
  },
  setUser: (user) => set({ user })
}));
