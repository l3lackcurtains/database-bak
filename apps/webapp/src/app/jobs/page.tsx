import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { JobsPage } from './page-content';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string }>;
}) {
  const params = await searchParams;
  const initialTab = params?.source === 'manual' ? 'manual' : 'scheduled';

  return (
    <DashboardLayout>
      <JobsPage initialTab={initialTab} />
    </DashboardLayout>
  );
}
