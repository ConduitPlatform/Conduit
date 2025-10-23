import { EmailStatusEnum } from '../models/EmailStatusEnum.js';
import config from '../config/index.js';
import { Indexable } from '@conduitplatform/grpc-sdk';

// Exclude the ESPs that do not support fetching status updates
export type Provider = Exclude<
  keyof typeof config.email.transportSettings,
  'amazonSes' | 'smtp'
>;

export const providerFinalStatusMap: {
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
export const providerStatusField: Record<Provider, string> = {
  mailgun: 'event',
  mailersend: 'status',
  mandrill: 'state',
  sendgrid: 'status',
};

export function mapProviderStatus(
  provider: Provider,
  rawProviderResponse: Indexable,
): EmailStatusEnum | null {
  const status = rawProviderResponse[providerStatusField[provider]];
  return providerFinalStatusMap[provider][status]
    ? providerFinalStatusMap[provider][status]
    : null;
}
