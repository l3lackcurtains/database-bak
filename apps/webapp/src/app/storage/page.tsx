import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StoragePage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <StoragePage />
    </DashboardLayout>
  );
}
