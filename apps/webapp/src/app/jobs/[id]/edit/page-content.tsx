'use client';

import { use, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { jobsApi } from '@/lib/api-routes';
import type { BackupJob } from '@/types';
import { JobForm } from '../../job-form';

export function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<BackupJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi.get(id)
      .then(setJob)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!job) {
    return <p className="text-sm text-muted-foreground">Job not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Job</h1>
        <p className="text-muted-foreground">Update job settings before the next run</p>
      </div>

      <JobForm job={job} />
    </div>
  );
}
