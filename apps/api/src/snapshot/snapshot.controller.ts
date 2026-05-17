import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
import { StorageService } from '../storage/storage.service';

@Controller('snapshots')
export class SnapshotController {
  constructor(
    private snapshotService: SnapshotService,
    private storageService: StorageService,
  ) {}

  @Get()
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('databaseId') databaseId?: string,
  ) {
    return this.snapshotService.findAll(
      parseInt(page),
      parseInt(limit),
      databaseId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.snapshotService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const snapshot = await this.snapshotService.findOne(id);
    if (snapshot && snapshot.storageKey) {
      const storage = await this.storageService.findOne(snapshot.storageId);
      if (storage) {
        await this.storageService.deleteFile(storage, snapshot.storageKey);
      }
    }
    await this.snapshotService.remove(id);
    return { success: true };
  }

  @Get(':id/download')
  async getDownloadUrl(@Param('id') id: string) {
    const snapshot = await this.snapshotService.findOne(id);
    if (!snapshot) throw new NotFoundException('Snapshot not found');
    const storage = await this.storageService.findOne(snapshot.storageId);
    if (!storage) throw new NotFoundException('Storage not found');
    return this.storageService.generateDownloadUrl(
      storage,
      snapshot.storageKey,
    );
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    return { snapshotId: id, message: 'Restore job created' };
  }
}
