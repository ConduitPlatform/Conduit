import { SandboxedJob } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { EmailRecord } from '../models/index.js';
import { QueueController } from '../controllers/queue.controller.js';
import { EmailStatusEnum } from '../models/EmailStatusEnum.js';
import { IJobData } from '../interfaces/index.js';
import { Config } from '../config/index.js';
import { mapProviderStatus, Provider } from '../utils/index.js';

let grpcSdk: ConduitGrpcSdk | undefined = undefined;

export default async (job: SandboxedJob<IJobData>) => {
  if (!grpcSdk) {
    if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
    grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'email', false);
    await grpcSdk.initialize();
    await grpcSdk.initializeEventBus();
    await grpcSdk.waitForExistence('email');
    await grpcSdk.waitForExistence('database');
    QueueController.getInstance(grpcSdk);
    EmailRecord.getInstance(grpcSdk.database!);
  }

  const { messageId, emailRecId, retries = 0 } = job.data;

  const rawProviderResponse = await grpcSdk.emailProvider!.getEmailStatus(messageId);
  const provider = ((await grpcSdk.config.get('email')) as Config).transport as Provider;
  const status = mapProviderStatus(provider, rawProviderResponse);

  const query = {
    status: status !== null ? status : undefined, // Does not update the status if it isn't final since mongoose ignores undefined values
    $addToSet: { rawProviderStatusResponses: JSON.stringify(rawProviderResponse) }, // Push the raw response to the array if it doesn't already exist
  };

  await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, query);

  // The status returned from the provider does not indicate finalization of the email delivery
  if (status === null) {
    if (retries < 5) {
      // Add the job back to the queue
      await QueueController.getInstance().addEmailStatusJob(
        messageId,
        emailRecId,
        retries + 1,
      );
    } else {
      await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, {
        status: EmailStatusEnum.FAILED,
      });
    }
  }
};
