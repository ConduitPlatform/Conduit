import { Trigger } from '../../models/trigger.interface';
import { CronInterface } from './cron.interface';

export class Cron implements Trigger<CronInterface> {


  setup(options: CronInterface): PromiseLike<boolean> {
    return Promise.resolve(false);
  }




}
