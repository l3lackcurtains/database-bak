import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UsersPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <UsersPage />
    </DashboardLayout>
  );
}
