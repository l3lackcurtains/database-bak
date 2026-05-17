import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { NewJobPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <NewJobPage />
    </DashboardLayout>
  );
}
