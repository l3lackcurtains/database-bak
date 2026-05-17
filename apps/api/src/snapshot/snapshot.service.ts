import { Injectable } from '@nestjs/common';
import { JsonStore } from '../common/json.store';
import { SnapshotEntity } from '../entities/snapshot.entity';
import { CreateSnapshotDto } from './snapshot.types';

@Injectable()
export class SnapshotService {
  constructor(private store: JsonStore) {}

  async findAll(page: number = 1, limit: number = 20, databaseId?: string) {
    let snapshots = this.store.getAll<SnapshotEntity>('snapshots');
    if (databaseId) {
      snapshots = snapshots.filter((s) => s.databaseId === databaseId);
    }
    const total = snapshots.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = snapshots.slice(start, start + limit);
    return { data, total, page, limit, totalPages };
  }

  async findOne(id: string): Promise<SnapshotEntity | null> {
    return this.store.getById<SnapshotEntity>('snapshots', id) || null;
  }

  async create(dto: CreateSnapshotDto): Promise<SnapshotEntity> {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    const entity: SnapshotEntity = {
      id,
      databaseId: dto.databaseId,
      databaseName: dto.databaseName,
      databaseType: dto.databaseType,
      storageId: dto.storageId,
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
    };
    return this.store.create('snapshots', entity);
  }

  async update(
    id: string,
    updates: Partial<SnapshotEntity>,
  ): Promise<SnapshotEntity | null> {
    return this.store.update<SnapshotEntity>('snapshots', id, updates);
  }

  async remove(id: string): Promise<void> {
    this.store.delete('snapshots', id);
  }

  async findByDatabaseId(databaseId: string): Promise<SnapshotEntity[]> {
    return this.store.findBy(
      'snapshots',
      (s: SnapshotEntity) => s.databaseId === databaseId,
    );
  }
}
