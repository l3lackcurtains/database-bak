import { JobForm } from '../job-form';

export function NewJobPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Job</h1>
        <p className="text-muted-foreground">Create a backup, restore, or migration job</p>
      </div>

      <JobForm />
    </div>
  );
}
