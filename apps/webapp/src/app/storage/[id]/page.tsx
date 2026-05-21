import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StorageDetailsPage } from './page-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DashboardLayout>
      <StorageDetailsPage params={params} />
    </DashboardLayout>
  );
}
