import { Injectable } from '@nestjs/common';
import { TursoStore } from '../common/turso.store';
import { SnapshotEntity } from '../entities/snapshot.entity';
import { CreateSnapshotDto } from './snapshot.types';
import { AuthUser } from '../auth/session';

@Injectable()
export class SnapshotService {
  constructor(private store: TursoStore) {}

  async findAll(page: number = 1, limit: number = 20, databaseId?: string, user?: AuthUser) {
    let snapshots = await this.store.getAll<SnapshotEntity>('snapshots');
    if (user && user.role !== 'admin') {
      snapshots = snapshots.filter((s: any) => s.userId === user.id || !s.userId);
    }
    if (databaseId) {
      snapshots = snapshots.filter((s) => s.databaseId === databaseId);
    }
    const total = snapshots.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = snapshots.slice(start, start + limit);
    return { data, total, page, limit, totalPages };
  }

  async findOne(id: string, user?: AuthUser): Promise<SnapshotEntity | null> {
    const s = (await this.store.getById<SnapshotEntity>('snapshots', id)) || null;
    if (!s) return null;
    if (user && user.role !== 'admin' && s.userId && s.userId !== user.id) {
      return null;
    }
    return s;
  }

  async create(dto: CreateSnapshotDto, user?: AuthUser): Promise<SnapshotEntity> {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    const entity: SnapshotEntity & { userId?: string | null } = {
      id,
      databaseId: dto.databaseId,
      databaseName: dto.databaseName,
      databaseType: dto.databaseType,
      storageId: dto.storageId,
      sourceType: dto.sourceType,
      sourceJobId: dto.sourceJobId,
      sourceJobName: dto.sourceJobName,
      storageKey: '',
      size: 0,
      compressedSize: 0,
      checksum: '',
      status: 'pending',
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      metadata: { version: '1.0' },
      createdAt: new Date().toISOString(),
      userId: user?.id || null,
    };
    return this.store.create('snapshots', entity);
  }

  async update(
    id: string,
    updates: Partial<SnapshotEntity>,
    user?: AuthUser,
  ): Promise<SnapshotEntity | null> {
    const existing = await this.findOne(id, user);
    if (!existing) return null;
    return this.store.update<SnapshotEntity>('snapshots', id, updates);
  }

  async remove(id: string, user?: AuthUser): Promise<void> {
    const existing = await this.findOne(id, user);
    if (!existing) throw new Error('Snapshot not found or unauthorized');
    await this.store.delete('snapshots', id);
  }

  async findByDatabaseId(databaseId: string, user?: AuthUser): Promise<SnapshotEntity[]> {
    const found = await this.store.findBy(
      'snapshots',
      (s: SnapshotEntity) => s.databaseId === databaseId,
    );
    return found.filter((s: any) => {
      if (!user || user.role === 'admin') return true;
      return s.userId === user.id || !s.userId;
    });
  }
}
