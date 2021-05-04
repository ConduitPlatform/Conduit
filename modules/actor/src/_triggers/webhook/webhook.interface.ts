import { TriggerOptions } from '../../models/trigger.interface';

export interface WebhookInterface extends TriggerOptions {
  route: string;
  mode: 'webhook' | 'request';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  auth?: boolean;
}
