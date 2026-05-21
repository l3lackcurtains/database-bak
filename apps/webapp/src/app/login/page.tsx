'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api-routes';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await authApi.login({ username, password });
      router.replace('/');
      router.refresh();
    } catch {
      setError('Invalid username or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border bg-card shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold">Database Bak</p>
                <p className="text-sm text-primary-foreground/70">Stateful collaboration layer</p>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-4xl font-bold tracking-tight">Durable state for human + agent workflows.</p>
              <p className="max-w-md text-sm leading-6 text-primary-foreground/75">
                Sign in to manage workspace state, snapshots, restore points, and long-running automation safely.
              </p>
            </div>
          </section>

          <Card className="border-0 shadow-none">
            <CardHeader className="space-y-3 px-6 pt-8 sm:px-10 sm:pt-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">Sign in</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">Use your dashboard credentials to continue.</p>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-8 sm:px-10 sm:pb-12">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium">Username</label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
