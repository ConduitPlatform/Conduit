import { TriggerOptions } from '../../models/trigger.interface';

export interface CronInterface extends TriggerOptions {
  cronString: string;
}
