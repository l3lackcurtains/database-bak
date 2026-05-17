import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DatabasesPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <DatabasesPage />
    </DashboardLayout>
  );
}
