import { create } from 'zustand';
import { authApi } from '@/lib/api-routes';

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  fetchUser: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  fetchUser: async () => {
    if (get().loading) return get().user;
    set({ loading: true });
    try {
      const res = await authApi.me();
      set({ user: res.user, initialized: true });
      return res.user;
    } catch {
      set({ user: null, initialized: true });
      return null;
    } finally {
      set({ loading: false });
    }
  },
  setUser: (user) => set({ user }),
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ user: null });
      window.location.href = '/login';
    }
  },
}));
