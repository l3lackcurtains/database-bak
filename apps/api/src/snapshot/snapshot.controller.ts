import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Readable } from 'stream';
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

  @Post(':id/verify')
  async verify(@Param('id') id: string) {
    const snapshot = await this.snapshotService.findOne(id);
    if (!snapshot) throw new NotFoundException('Snapshot not found');
    if (!snapshot.storageKey) {
      throw new BadRequestException('Snapshot has no storage key');
    }

    const storage = await this.storageService.findOne(snapshot.storageId);
    if (!storage) throw new NotFoundException('Storage not found');

    const stream = await this.storageService.downloadFileStream(
      storage,
      snapshot.storageKey,
    );

    const result = await verifyStream(stream, snapshot.checksum);
    return {
      ...result,
      snapshotId: id,
      verifiedAt: new Date().toISOString(),
    };
  }
}

async function verifyStream(
  stream: Readable,
  storedChecksum: string,
): Promise<{
  valid: boolean;
  checksum: { computed: string; stored: string; match: boolean };
  format: { valid: boolean; detected?: string };
  size: number;
}> {
  const hash = createHash('sha256');
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of stream) {
    hash.update(chunk);
    chunks.push(chunk);
    totalSize += chunk.length;
  }

  const computedChecksum = hash.digest('hex');
  const checksumMatch = computedChecksum === storedChecksum;

  let formatValid = false;
  let detectedFormat: string | undefined;

  if (totalSize > 0) {
    const firstBytes = Buffer.concat(chunks).subarray(0, 16);

    if (firstBytes[0] === 0x1f && firstBytes[1] === 0x8b) {
      detectedFormat = 'gzip';
      formatValid = true;
    } else if (
      firstBytes[0] === 0x50 &&
      firstBytes[1] === 0x47 &&
      firstBytes[2] === 0x44 &&
      firstBytes[3] === 0x4d &&
      firstBytes[4] === 0x50
    ) {
      detectedFormat = 'pg_dump_custom';
      formatValid = true;
    } else {
      detectedFormat = 'unknown';
      formatValid = false;
    }
  }

  const valid = checksumMatch && formatValid;

  return {
    valid,
    checksum: {
      computed: computedChecksum,
      stored: storedChecksum,
      match: checksumMatch,
    },
    format: { valid: formatValid, detected: detectedFormat },
    size: totalSize,
  };
}
