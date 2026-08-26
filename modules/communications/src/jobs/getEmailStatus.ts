import { Job, Processor } from 'bullmq';
import { Communications, ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { EmailRecord } from '../models/index.js';
import { EmailStatusEnum } from '../models/EmailStatusEnum.js';
import { IJobData } from '../interfaces/index.js';
import { mapProviderStatus, Provider } from '../utils/index.js';

export function createGetEmailStatusProcessor(
  grpcSdk: ConduitGrpcSdk,
  addEmailStatusJob: (
    messageId: string,
    emailRecId: string,
    retries: number,
    provider: Provider,
  ) => Promise<unknown>,
): Processor<IJobData> {
  return async (job: Job<IJobData>) => {
    const { messageId, emailRecId, retries = 0, provider } = job.data;

    const communications = grpcSdk.getModule('communications') as Communications;
    const rawProviderResponse = await communications.getEmailStatus(messageId);
    const status = mapProviderStatus(provider, rawProviderResponse);

    const query = {
      status: status !== null ? status : undefined, // Does not update the status if it isn't final since mongoose ignores undefined values
      $addToSet: { rawProviderStatusResponses: JSON.stringify(rawProviderResponse) }, // Push the raw response to the array if it doesn't already exist
    };

    await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, query);

    // The status returned from the provider does not indicate finalization of the email delivery
    if (status === null) {
      if (retries < 5) {
        await addEmailStatusJob(messageId, emailRecId, retries + 1, provider);
      } else {
        await EmailRecord.getInstance().findByIdAndUpdate(emailRecId, {
          status: EmailStatusEnum.FAILED,
        });
      }
    }
  };
}
