'use client';

import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { BrandLogo } from '@/components/brand/logo';
import {
  LayoutDashboard,
  Database,
  ArrowLeftRight,
  Settings,
  ChevronLeft,
  ChevronRight,
  Archive,
  HardDrive,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: ArrowLeftRight, label: 'Jobs', href: '/jobs' },
  { icon: Database, label: 'Databases', href: '/databases' },
  { icon: Archive, label: 'Snapshots', href: '/snapshots' },
  { icon: HardDrive, label: 'Storage', href: '/storage' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-aurora-sm transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/" className={cn('flex items-center gap-2', collapsed && 'sr-only')}>
          <BrandLogo />
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">Crumet Sync</span>
        </Link>
        <button
          onClick={toggle}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                collapsed && 'justify-center',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
