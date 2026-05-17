import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RestoreSnapshotPage } from './page-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DashboardLayout>
      <RestoreSnapshotPage params={params} />
    </DashboardLayout>
  );
}
