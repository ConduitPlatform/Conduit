import { Queue, Worker, Job } from 'bullmq';
import { Redis, Cluster } from 'ioredis';
import { EmailRecord } from '../models/index.js';
import { IJobData } from '../interfaces/index.js';
import { ConfigController } from '@conduitplatform/module-tools';
import config from '../config/config.js';

type Provider = Exclude<keyof typeof config.transportSettings, 'amazonSes' | 'smtp'>;

export class QueueManager {
  private readonly emailStatusQueue: Queue;
  private readonly maxRetries: number = 5;
  private readonly retryDelay: number = 5 * 1000;
  private emailWorker: Worker<IJobData>;

  // Map of statuses returned from each provider indicating finalization of the email delivery, to the status to be set in the database
  private readonly providerFinalStatusMap: {
    [key in Provider]: Record<string, 'delivered' | 'failed'>;
  } = {
    mailgun: {
      delivered: 'delivered',
      failed: 'failed',
      rejected: 'failed',
    },
    mailersend: {
      delivered: 'delivered',
      soft_bounced: 'failed',
      hard_bounced: 'failed',
    },
    mandrill: {
      rejected: 'failed',
      sent: 'delivered',
      bounced: 'failed',
    },
    sendgrid: {
      delivered: 'delivered',
      not_delivered: 'failed',
    },
  };

  // Settings about which field in the ESP's response contains the status
  private readonly providerSettings: Record<Provider, string> = {
    mailgun: 'event',
    mailersend: 'status',
    mandrill: 'state',
    sendgrid: 'status',
  };

  constructor(
    private readonly redisConnection: Redis | Cluster,
    private readonly getEmailStatus: (messageId: string) => Promise<any>,
  ) {
    this.emailStatusQueue = new Queue('email-status-updates', {
      connection: this.redisConnection,
    });
    this.startWorker();
  }

  private async processJob(job: Job<IJobData>) {
    const { messageId, emailRecId, retries = 0 } = job.data;
    const rawProviderResponse = await this.getEmailStatus(messageId);

    const provider = ConfigController.getInstance().config.transport as Provider;
    const status = this.mapProviderStatus(provider, rawProviderResponse);

    // The status returned from the provider does not indicate finalization of the email delivery
    if (status === null) {
      if (retries < this.maxRetries) {
        await this.emailStatusQueue.add(
          'email-status-updates',
          {
            messageId,
            emailRecId,
            retries: retries + 1,
          },
          { delay: this.retryDelay * (retries + this.maxRetries) },
        );
        console.log(`Retrying job ${job.id} (${retries + 1}/${this.maxRetries})`);
      } else {
        await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, {
          status: 'failed',
        });
        console.error(`Job ${job.id} failed after ${this.maxRetries} retries.`);
      }
      console.log(`Job ${job.id} status is not final. Retrying...`);
    } else {
      await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, {
        status,
      });
      console.log(`Job ${job.id} completed with status: ${status}`);
    }
  }

  private mapProviderStatus(
    provider: Provider,
    rawProviderResponse: any,
  ): 'delivered' | 'failed' | null {
    const status = rawProviderResponse[this.providerSettings[provider]];
    console.log('Provider status:', status);
    if (this.providerFinalStatusMap[provider][status]) {
      return this.providerFinalStatusMap[provider][status];
    }
    return null;
  }

  startWorker() {
    if (this.emailWorker) {
      return;
    }

    this.emailWorker = new Worker<IJobData>(
      'email-status-updates',
      this.processJob.bind(this),
      {
        connection: this.redisConnection,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );

    this.emailWorker.on('completed', job => {
      console.log(`Email status update job ${job.id} completed`);
    });

    this.emailWorker.on('failed', (job, error) => {
      console.error(`Email status update job ${job?.id} failed:`, error);
    });
  }

  getQueue() {
    return this.emailStatusQueue;
  }
}
