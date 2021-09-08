import { TriggerOptions } from '../../models/trigger.interface';

export interface EventInterface extends TriggerOptions {
  eventName: string;
}
