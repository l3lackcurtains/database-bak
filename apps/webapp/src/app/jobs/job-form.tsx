'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { jobsApi, databasesApi, storageApi } from '@/lib/api-routes';
import type { BackupJob, Database, StorageConfig } from '@/types';

type JobFormState = {
  name: string;
  databaseId: string;
  storageId: string;
  type: 'backup' | 'restore' | 'migrate';
  compress: boolean;
  encrypt: boolean;
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  cronExpression: string;
  timezone: string;
};

function initialState(job?: BackupJob | null): JobFormState {
  return {
    name: job?.name || '',
    databaseId: job?.databaseId || '',
    storageId: job?.storageId || '',
    type: job?.type || 'backup',
    compress: job?.options.compress ?? true,
    encrypt: job?.options.encrypt ?? false,
    frequency: (job?.schedule?.frequency as JobFormState['frequency']) || 'once',
    cronExpression: job?.schedule?.cronExpression || '',
    timezone: job?.schedule?.timezone || 'UTC',
  };
}

function scheduledPayload(form: JobFormState) {
  return form.frequency !== 'once'
    ? {
        frequency: form.frequency,
        cronExpression: form.cronExpression || undefined,
        timezone: form.timezone,
      }
    : undefined;
}

function toCreatePayload(form: JobFormState) {
  return {
    name: form.name,
    databaseId: form.databaseId,
    storageId: form.storageId,
    type: form.type,
    schedule: scheduledPayload(form),
    options: {
      compress: form.compress,
      encrypt: form.encrypt,
    },
  };
}

function toUpdatePayload(form: JobFormState) {
  return {
    ...toCreatePayload(form),
    schedule: scheduledPayload(form) || null,
  };
}

export function JobForm({ job }: { job?: BackupJob | null }) {
  const router = useRouter();
  const isEditing = Boolean(job);
  const [form, setForm] = useState<JobFormState>(() => initialState(job));
  const [databases, setDatabases] = useState<Database[]>([]);
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    databasesApi.list().then(setDatabases).catch(console.error);
    storageApi.list().then(setStorageConfigs).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (job) {
        await jobsApi.update(job.id, toUpdatePayload(form));
      } else {
        await jobsApi.create(toCreatePayload(form));
      }
      router.push('/jobs');
    } catch (err) {
      alert(`Failed to ${isEditing ? 'update' : 'create'} job`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Job Configuration</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Job Name</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Daily production backup"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
              >
                <option value="backup">Backup</option>
                <option value="restore">Restore</option>
                <option value="migrate">Migrate</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Database</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.databaseId}
                onChange={(e) => setForm({ ...form, databaseId: e.target.value })}
                required
              >
                <option value="">Select database...</option>
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>{db.name} ({db.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Storage</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.storageId}
                onChange={(e) => setForm({ ...form, storageId: e.target.value })}
                required
              >
                <option value="">Select storage...</option>
                {storageConfigs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.provider})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Schedule</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })}
              >
                <option value="once">Run once</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {form.frequency !== 'once' && (
              <div>
                <label className="text-sm font-medium">Cron Expression</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.cronExpression}
                  onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                  placeholder="0 2 * * *"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.compress}
                onChange={(e) => setForm({ ...form, compress: e.target.checked })}
                className="h-4 w-4"
              />
              Compress backup
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.encrypt}
                onChange={(e) => setForm({ ...form, encrypt: e.target.checked })}
                className="h-4 w-4"
              />
              Encrypt backup
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/jobs')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Job'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
