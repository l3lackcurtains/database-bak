'use client';

import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

const pageTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/databases': 'Databases',
  '/snapshots': 'Snapshots',
  '/jobs': 'Backup Jobs',
  '/jobs/manual': 'Manual Backup',
  '/jobs/new': 'Scheduled Job',
  '/storage': 'Storage',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export function Header() {
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const pathname = usePathname();
  const title = pageTitle[pathname] || (pathname.includes('/restore') ? 'Restore Snapshot' : pathname.includes('/edit') ? 'Edit Job' : pathname.startsWith('/jobs/') ? 'Job Details' : 'Dashboard');

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
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
