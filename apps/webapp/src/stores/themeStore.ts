import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: (theme) => {
    set({ theme });
    const root = document.documentElement;
    if (
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      root.classList.add('dark');
      set({ resolvedTheme: 'dark' });
    } else {
      root.classList.remove('dark');
      set({ resolvedTheme: 'light' });
    }
  },
  toggleTheme: () => {
    const { resolvedTheme } = get();
    get().setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  },
}));
