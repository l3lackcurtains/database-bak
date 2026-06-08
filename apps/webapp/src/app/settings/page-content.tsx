'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useThemeStore } from '@/stores/themeStore';
import { authApi, usersApi, type UserInfo } from '@/lib/api-routes';
import { Lock, Plus, Trash2, ShieldCheck, User as UserIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';

function UserForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await usersApi.create({ username, password, role });
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div>
        <label className="text-sm font-medium">Username</label>
        <input
          className="mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          value={username} onChange={(e) => setUsername(e.target.value)} required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          className="mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Role</label>
        <select
          className="mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          value={role} onChange={(e) => setRole(e.target.value)}
        >
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
          <option value="operator">Operator</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add User'}</Button>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    setPwSaving(true);
    try {
      await authApi.changePassword({ currentPassword: pwCurrent, newPassword: pwNew });
      setPwCurrent('');
      setPwNew('');
      setPwSuccess(true);
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const fetchUsers = useCallback(() => {
    usersApi.list()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await usersApi.delete(id);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure application preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Theme</label>
              <div className="flex gap-2 mt-2">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <Button
                    key={t}
                    variant={theme === t ? 'default' : 'outline'}
                    onClick={() => setTheme(t)}
                    className="capitalize"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && <UserForm onDone={() => { setShowForm(false); fetchUsers(); }} />}

          {loading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      {u.username}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="text-sm font-medium">Current Password</label>
              <input
                type="password"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} required
              />
            </div>
            <div>
              <label className="text-sm font-medium">New Password</label>
              <input
                type="password"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={pwNew} onChange={(e) => setPwNew(e.target.value)} required minLength={6}
              />
            </div>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-600 dark:text-green-400">Password changed successfully.</p>}
            <Button type="submit" disabled={pwSaving}>
              <Lock className="h-4 w-4" /> {pwSaving ? 'Saving...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>API Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">API URL</label>
              <p className="text-sm text-muted-foreground mt-1">
                {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7301/api'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
