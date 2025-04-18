import { Indexable } from '@conduitplatform/grpc-sdk';

export interface ISendEmailParams {
  email: string;
  body?: string;
  subject?: string;
  variables: Indexable;
  sender: string;
  cc?: string[];
  replyTo?: string;
  attachments?: string[];
}
