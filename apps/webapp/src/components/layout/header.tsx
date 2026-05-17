'use client';

import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

const pageTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/databases': 'Databases',
  '/snapshots': 'Snapshots',
  '/jobs': 'Backup Jobs',
  '/jobs/new': 'New Job',
  '/storage': 'Storage',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export function Header() {
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const pathname = usePathname();
  const title = pageTitle[pathname] || 'Dashboard';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {resolvedTheme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
}
