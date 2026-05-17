'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { snapshotsApi } from '@/lib/api-routes';
import type { Snapshot } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { HardDrive, RefreshCw, Trash2, Download, RotateCcw, Eye } from 'lucide-react';

export function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSnapshots = () => {
    snapshotsApi.list({ page, limit: 20 })
      .then((res) => {
        setSnapshots(res.data);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSnapshots(); }, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snapshot? This cannot be undone.')) return;
    await snapshotsApi.delete(id);
    fetchSnapshots();
  };

  const handleRestore = async (snapshot: Snapshot) => {
    const targetId = prompt('Enter target database ID to restore to:');
    if (!targetId) return;
    const clean = confirm('Clean target database before restore?');
    await snapshotsApi.restore(snapshot.id, targetId, clean);
    alert('Restore job created');
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await snapshotsApi.downloadUrl(id);
      window.open(res.url, '_blank');
    } catch {
      alert('Failed to generate download link');
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
      completed: 'success', failed: 'destructive', creating: 'warning', pending: 'secondary',
    };
    return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Snapshots</h1>
          <p className="text-muted-foreground">Database backups stored in object storage</p>
        </div>
        <Button variant="outline" onClick={fetchSnapshots}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
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
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Database</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[120px]">Size</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[160px]">Created</TableHead>
                    <TableHead className="w-[160px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[220px] truncate font-medium">{s.databaseName}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{s.databaseType}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{formatNumber(s.compressedSize)}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(s.id)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRestore(s)} title="Restore">
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
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
