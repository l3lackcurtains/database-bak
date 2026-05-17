import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { SettingsPage } from './page-content';

export default function Page() {
  return (
    <DashboardLayout>
      <SettingsPage />
    </DashboardLayout>
  );
}
