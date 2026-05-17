'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { jobsApi, snapshotsApi } from '@/lib/api-routes';
import type { BackupJob, Snapshot } from '@/types';
import { formatBytes, formatDate } from '@/lib/utils';
import { Play, RefreshCw, Trash2, Download, RotateCcw } from 'lucide-react';

const PAGE_SIZE = 20;

export function SnapshotsPage() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSnapshots = useCallback(() => {
    Promise.all([
      snapshotsApi.list({ page, limit: PAGE_SIZE }),
      jobsApi.list({ limit: 100, type: 'backup' }),
    ])
      .then(([snapshotRes, jobRes]) => {
        if (snapshotRes.total > 0 && page > snapshotRes.totalPages) {
          setPage(snapshotRes.totalPages);
          return;
        }

        setSnapshots(snapshotRes.data);
        setTotal(snapshotRes.total);
        setTotalPages(snapshotRes.totalPages);
        setJobs(jobRes.data);
        setSelectedIds(new Set());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const jobsBySnapshotId = useMemo(() => {
    const map = new Map<string, BackupJob>();
    jobs.forEach((job) => {
      if (job.snapshotId) map.set(job.snapshotId, job);
    });
    return map;
  }, [jobs]);

  const selectedSnapshots = useMemo(
    () => snapshots.filter((snapshot) => selectedIds.has(snapshot.id)),
    [selectedIds, snapshots],
  );

  const allPageSelected = snapshots.length > 0 && selectedIds.size === snapshots.length;
  const somePageSelected = selectedIds.size > 0 && !allPageSelected;
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) items.push('ellipsis-start');
    for (let current = start; current <= end; current += 1) items.push(current);
    if (end < totalPages - 1) items.push('ellipsis-end');

    items.push(totalPages);
    return items;
  }, [page, totalPages]);

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(snapshots.map((snapshot) => snapshot.id)) : new Set());
  };

  const toggleSnapshot = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snapshot? This cannot be undone.')) return;
    await snapshotsApi.delete(id);
    fetchSnapshots();
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await snapshotsApi.downloadUrl(id);
      window.open(res.url, '_blank');
    } catch {
      alert('Failed to generate download link');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSnapshots.length === 0) return;
    const count = selectedSnapshots.length;
    if (!confirm(`Delete ${count} selected snapshot${count === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setBulkWorking(true);
    try {
      await Promise.all(selectedSnapshots.map((snapshot) => snapshotsApi.delete(snapshot.id)));
      fetchSnapshots();
    } catch {
      alert('Failed to delete one or more selected snapshots');
    } finally {
      setBulkWorking(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedSnapshots.length === 0) return;

    setBulkWorking(true);
    try {
      const urls = await Promise.all(selectedSnapshots.map((snapshot) => snapshotsApi.downloadUrl(snapshot.id)));
      urls.forEach((res) => window.open(res.url, '_blank'));
    } catch {
      alert('Failed to generate one or more download links');
    } finally {
      setBulkWorking(false);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
      completed: 'success', failed: 'destructive', creating: 'warning', pending: 'secondary',
    };
    return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
  };

  const sourceBadge = (snapshot: Snapshot) => {
    const sourceJob = snapshot.sourceJobId ? jobs.find((job) => job.id === snapshot.sourceJobId) : jobsBySnapshotId.get(snapshot.id);
    const sourceType = snapshot.sourceType || (sourceJob ? (sourceJob.name.toLowerCase().startsWith('manual backup') || !sourceJob.schedule ? 'manual' : 'scheduled') : undefined);

    return (
      <Badge variant={sourceType === 'manual' ? 'info' : 'secondary'} className="capitalize">
        {sourceType || 'Unknown'}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Snapshots</h1>
          <p className="text-muted-foreground">Database backups stored in object storage</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={fetchSnapshots}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => router.push('/jobs/manual')}>
            <Play className="h-4 w-4" /> Manual Backup
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No snapshots yet. Create a backup job to get started.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected on this page
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={selectedIds.size === 0 || bulkWorking} onClick={handleBulkDownload}>
                    <Download className="h-4 w-4" /> Download selected
                  </Button>
                  <Button variant="destructive" size="sm" disabled={selectedIds.size === 0 || bulkWorking} onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4" /> Delete selected
                  </Button>
                  <Button variant="ghost" size="sm" disabled={selectedIds.size === 0 || bulkWorking} onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]">
                      <input
                        type="checkbox"
                        aria-label="Select all snapshots on this page"
                        checked={allPageSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = somePageSelected;
                        }}
                        onChange={(event) => toggleAll(event.target.checked)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                    </TableHead>
                    <TableHead className="w-[220px]">Database</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[120px]">Source</TableHead>
                    <TableHead className="w-[120px]">Size</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[160px]">Created</TableHead>
                    <TableHead className="w-[160px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s) => (
                    <TableRow key={s.id} data-state={selectedIds.has(s.id) ? 'selected' : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select snapshot for ${s.databaseName}`}
                          checked={selectedIds.has(s.id)}
                          onChange={(event) => toggleSnapshot(s.id, event.target.checked)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{s.databaseName}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{s.databaseType}</Badge></TableCell>
                      <TableCell>{sourceBadge(s)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatBytes(s.compressedSize)}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(s.id)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={s.status !== 'completed'}
                            onClick={() => router.push(`/snapshots/${s.id}/restore`)}
                            title="Restore"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {total} snapshots
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>
                    First
                  </Button>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {paginationItems.map((item) => (
                      typeof item === 'number' ? (
                        <Button
                          key={item}
                          variant={item === page ? 'default' : 'outline'}
                          size="sm"
                          aria-current={item === page ? 'page' : undefined}
                          onClick={() => setPage(item)}
                          className="min-w-9 px-3"
                        >
                          {item}
                        </Button>
                      ) : (
                        <span key={item} className="px-2 text-sm text-muted-foreground">...</span>
                      )
                    ))}
                  </div>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    Next
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                    Last
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
