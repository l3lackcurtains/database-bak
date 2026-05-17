import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { EditJobPage } from './page-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <DashboardLayout>
      <EditJobPage params={params} />
    </DashboardLayout>
  );
}
