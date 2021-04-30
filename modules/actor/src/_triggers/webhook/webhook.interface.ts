import { TriggerOptions } from '../../models/trigger.interface';

export interface WebhookInterface extends TriggerOptions {
  route: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  auth?: boolean;
}
