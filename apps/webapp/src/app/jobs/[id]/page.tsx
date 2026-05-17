import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { JobDetailsPage } from './page-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DashboardLayout>
      <JobDetailsPage params={params} />
    </DashboardLayout>
  );
}
