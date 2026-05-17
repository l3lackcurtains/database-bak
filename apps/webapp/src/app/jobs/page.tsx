import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { JobsPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <JobsPage />
    </DashboardLayout>
  );
}
