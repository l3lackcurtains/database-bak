import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { SnapshotsPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <SnapshotsPage />
    </DashboardLayout>
  );
}
