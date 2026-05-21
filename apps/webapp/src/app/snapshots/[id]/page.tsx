import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { SnapshotDetailsPage } from './page-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DashboardLayout>
      <SnapshotDetailsPage params={params} />
    </DashboardLayout>
  );
}
