'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { jobsApi, databasesApi, storageApi } from '@/lib/api-routes';
import type { BackupJob, Database, StorageConfig } from '@/types';

type SchedulePreset = 'hourly' | 'every6' | 'every12' | 'twiceDaily' | 'threeDaily' | 'daily' | 'weekly' | 'monthly';

type JobFormState = {
  name: string;
  databaseId: string;
  storageId: string;
  type: 'backup' | 'restore' | 'migrate';
  compress: boolean;
  encrypt: boolean;
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  frequencies: Array<'hourly' | 'daily' | 'weekly' | 'monthly'>;
  schedulePresets: SchedulePreset[];
  timezone: string;
  keepHourly: number;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
};

const scheduleOptions: Array<{ value: SchedulePreset; label: string; description: string }> = [
  { value: 'hourly', label: 'Hourly', description: 'Run every hour' },
  { value: 'every6', label: 'Every 6 hours', description: 'Run four times a day' },
  { value: 'every12', label: 'Every 12 hours', description: 'Run twice a day' },
  { value: 'threeDaily', label: 'Three times a day', description: 'Run every 8 hours' },
  { value: 'daily', label: 'Daily', description: 'Run once per day' },
  { value: 'weekly', label: 'Weekly', description: 'Run once per week' },
  { value: 'monthly', label: 'Monthly', description: 'Run once per month' },
];

function presetsFromJob(job?: BackupJob | null): SchedulePreset[] {
  const intervals = job?.schedule?.intervalsHours?.length
    ? job.schedule.intervalsHours
    : job?.schedule?.intervalHours
      ? [job.schedule.intervalHours]
      : [];
  const presets: SchedulePreset[] = [];
  for (const interval of intervals) {
    if (interval === 6) presets.push('every6');
    if (interval === 8) presets.push('threeDaily');
    if (interval === 12) presets.push('every12');
  }
  const frequencies = job?.schedule?.frequencies?.length ? job.schedule.frequencies : job?.schedule ? [job.schedule.frequency] : [];
  for (const frequency of frequencies) {
    if (frequency === 'hourly' || frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') {
      presets.push(frequency);
    }
  }
  return Array.from(new Set(presets));
}

function initialState(job?: BackupJob | null, scheduledOnly = false): JobFormState {
  const frequencies = (job?.schedule?.frequencies?.filter((frequency) => frequency !== 'once' && frequency !== 'custom') ||
    (job?.schedule?.frequency && job.schedule.frequency !== 'once' && job.schedule.frequency !== 'custom' ? [job.schedule.frequency] : []) ||
    []) as JobFormState['frequencies'];
  const defaultFrequencies = scheduledOnly ? ['daily'] as JobFormState['frequencies'] : [];

  return {
    name: job?.name || '',
    databaseId: job?.databaseId || '',
    storageId: job?.storageId || '',
    type: job?.type || 'backup',
    compress: job?.options.compress ?? true,
    encrypt: job?.options.encrypt ?? false,
    frequency: (job?.schedule?.frequency as JobFormState['frequency']) || (scheduledOnly ? 'daily' : 'once'),
    frequencies: frequencies.length ? frequencies : defaultFrequencies,
    schedulePresets: presetsFromJob(job).length ? presetsFromJob(job) : scheduledOnly ? ['daily'] : [],
    timezone: job?.schedule?.timezone || 'UTC',
    keepHourly: job?.options.retention?.hourly ?? 24,
    keepDaily: job?.options.retention?.daily ?? 7,
    keepWeekly: job?.options.retention?.weekly ?? 4,
    keepMonthly: job?.options.retention?.monthly ?? 6,
  };
}

function scheduledPayload(form: JobFormState) {
  const intervalMap: Partial<Record<SchedulePreset, number>> = {
    every6: 6,
    every12: 12,
    threeDaily: 8,
  };
  const intervalsHours = form.schedulePresets
    .map((preset) => intervalMap[preset])
    .filter(Boolean) as number[];
  const frequencies = form.schedulePresets.filter(
    (preset): preset is JobFormState['frequencies'][number] =>
      preset === 'hourly' || preset === 'daily' || preset === 'weekly' || preset === 'monthly',
  );
  const frequency = frequencies[0] || 'custom';
  return {
    frequency,
    frequencies,
    intervalHours: intervalsHours[0],
    intervalsHours,
    timezone: form.timezone,
  };
}

function toCreatePayload(form: JobFormState) {
  return {
    name: form.name,
    databaseId: form.databaseId,
    storageId: form.storageId,
    type: 'backup' as const,
    schedule: scheduledPayload(form),
    options: {
      compress: form.compress,
      encrypt: form.encrypt,
      retention: {
        hourly: form.keepHourly,
        daily: form.keepDaily,
        weekly: form.keepWeekly,
        monthly: form.keepMonthly,
      },
    },
  };
}

function toUpdatePayload(form: JobFormState, job: BackupJob) {
  return {
    ...toCreatePayload(form),
    type: form.type,
    schedule: form.schedulePresets.length ? scheduledPayload(form) : null,
    options: {
      ...job.options,
      compress: form.compress,
      encrypt: form.encrypt,
      retention: {
        hourly: form.keepHourly,
        daily: form.keepDaily,
        weekly: form.keepWeekly,
        monthly: form.keepMonthly,
      },
    },
  };
}

export function JobForm({ job, scheduledOnly = false }: { job?: BackupJob | null; scheduledOnly?: boolean }) {
  const router = useRouter();
  const isEditing = Boolean(job);
  const [form, setForm] = useState<JobFormState>(() => initialState(job, scheduledOnly));
  const [databases, setDatabases] = useState<Database[]>([]);
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleSchedulePreset = (preset: SchedulePreset) => {
    const next = form.schedulePresets.includes(preset)
      ? form.schedulePresets.filter((item) => item !== preset)
      : [...form.schedulePresets, preset];
    setForm({ ...form, schedulePresets: next });
  };

  useEffect(() => {
    databasesApi.list().then(setDatabases).catch(console.error);
    storageApi.list().then(setStorageConfigs).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scheduledOnly && form.schedulePresets.length === 0) {
      alert('Select at least one backup schedule.');
      return;
    }
    setLoading(true);
    try {
      if (job) {
        await jobsApi.update(job.id, toUpdatePayload(form, job));
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
          </div>

          <div className="space-y-3 rounded-md border border-input p-4">
            <div>
              <h3 className="text-sm font-medium">Backup Schedule</h3>
              <p className="text-sm text-muted-foreground">Choose how often this job should run.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scheduleOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.schedulePresets.includes(option.value)}
                    onChange={() => toggleSchedulePreset(option.value)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-input p-4">
            <div>
              <h3 className="text-sm font-medium">Retention</h3>
              <p className="text-sm text-muted-foreground">Limit how many snapshots this job should keep for each interval.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['keepHourly', 'Hourly'],
                ['keepDaily', 'Daily'],
                ['keepWeekly', 'Weekly'],
                ['keepMonthly', 'Monthly'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-sm font-medium">Keep {label}</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form[key as keyof JobFormState] as number}
                    onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
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
