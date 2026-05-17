import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ManualBackupPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <ManualBackupPage />
    </DashboardLayout>
  );
}
