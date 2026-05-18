import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { JobService } from './job.service';

@Processor('jobs', { concurrency: 1 })
export class JobProcessor extends WorkerHost {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(private readonly jobService: JobService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} with payload: ${JSON.stringify(job.data)}`);
    const { jobId } = job.data;
    if (jobId) {
      await this.jobService.executeJob(jobId);
    }
  }
}
