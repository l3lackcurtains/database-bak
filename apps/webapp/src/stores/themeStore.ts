import { create } from 'zustand';

const STORAGE_KEY = 'dbak-theme';

function getInitialTheme(): 'light' | 'dark' | 'system' {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) return 'dark';
  return 'light';
}

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
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    const resolved = resolveTheme(theme);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    set({ theme, resolvedTheme: resolved });
  },
  toggleTheme: () => {
    const { resolvedTheme } = get();
    get().setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  },
}));
