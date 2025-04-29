import { Job, Queue, Worker } from 'bullmq';
import { Cluster, Redis } from 'ioredis';
import { EmailRecord } from '../models/index.js';
import { IJobData } from '../interfaces/index.js';
import { ConfigController } from '@conduitplatform/module-tools';
import config from '../config/config.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { EmailStatusEnum } from '../models/EmailStatusEnum.js';

// Exclude the ESPs that do not support fetching status updates
type Provider = Exclude<keyof typeof config.transportSettings, 'amazonSes' | 'smtp'>;

export class QueueManager {
  private readonly emailStatusQueue: Queue;
  private readonly maxRetries: number = 5;
  private readonly retryDelay: number = 5 * 1000;
  private emailWorker: Worker<IJobData>;

  // Map statuses returned from each provider that indicate finalization of the email delivery, to the status to be set in the database
  private readonly providerFinalStatusMap: {
    [key in Provider]: Record<string, EmailStatusEnum>;
  } = {
    mailgun: {
      delivered: EmailStatusEnum.DELIVERED,
      failed: EmailStatusEnum.FAILED,
      rejected: EmailStatusEnum.FAILED,
    },
    mailersend: {
      delivered: EmailStatusEnum.DELIVERED,
      soft_bounced: EmailStatusEnum.FAILED,
      hard_bounced: EmailStatusEnum.FAILED,
    },
    mandrill: {
      rejected: EmailStatusEnum.FAILED,
      sent: EmailStatusEnum.DELIVERED,
      bounced: EmailStatusEnum.FAILED,
    },
    sendgrid: {
      delivered: EmailStatusEnum.DELIVERED,
      not_delivered: EmailStatusEnum.FAILED,
    },
  };

  // Specifies which field in the ESP's response contains the status
  private readonly providerStatusField: Record<Provider, string> = {
    mailgun: 'event',
    mailersend: 'status',
    mandrill: 'state',
    sendgrid: 'status',
  };

  constructor(
    private readonly redisConnection: Redis | Cluster,
    private readonly getEmailStatus: (messageId: string) => Promise<Indexable>,
  ) {
    this.emailStatusQueue = new Queue('email-status-updates', {
      connection: this.redisConnection,
    });
    this.startWorker();
  }

  private async processJob(job: Job<IJobData>) {
    const { messageId, emailRecId, retries = 0 } = job.data;
    const rawProviderResponse = await this.getEmailStatus(messageId);

    const provider = ConfigController.getInstance().config.transport;
    const status = this.mapProviderStatus(provider, rawProviderResponse);

    const query = {
      status: status !== null ? status : undefined, // Does not update the status if it isn't final since mongoose ignores undefined values
      $addToSet: { rawProviderStatusResponses: JSON.stringify(rawProviderResponse) }, // Push the raw response to the array if it doesn't already exist
    };

    await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, query);

    // The status returned from the provider does not indicate finalization of the email delivery
    if (status === null) {
      if (retries < this.maxRetries) {
        // Retry the job after a delay
        await this.emailStatusQueue.add(
          'email-status-updates',
          {
            messageId,
            emailRecId,
            retries: retries + 1,
          },
          { delay: this.retryDelay * (retries + this.maxRetries) },
        );
      } else {
        await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, {
          status: EmailStatusEnum.FAILED,
        });
      }
    }
  }

  private mapProviderStatus(
    provider: Provider,
    rawProviderResponse: Indexable,
  ): EmailStatusEnum | null {
    const status = rawProviderResponse[this.providerStatusField[provider]];
    return this.providerFinalStatusMap[provider][status]
      ? this.providerFinalStatusMap[provider][status]
      : null;
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
