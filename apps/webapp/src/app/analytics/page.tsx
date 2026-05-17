import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function Page() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Backup trends and storage analytics</p>
        </div>
        <p className="text-muted-foreground">Coming soon...</p>
      </div>
    </DashboardLayout>
  );
}
