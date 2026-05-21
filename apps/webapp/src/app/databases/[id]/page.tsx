import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DatabaseDetailsPage } from './page-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DashboardLayout>
      <DatabaseDetailsPage params={params} />
    </DashboardLayout>
  );
}
