import { JobForm } from '../job-form';

export function NewJobPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scheduled Job</h1>
        <p className="text-muted-foreground">Create a recurring backup, restore, or migration job</p>
      </div>

      <JobForm scheduledOnly />
    </div>
  );
}
