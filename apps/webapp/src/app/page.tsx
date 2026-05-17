import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DashboardPage } from '@/app/dashboard/page-content';

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}
