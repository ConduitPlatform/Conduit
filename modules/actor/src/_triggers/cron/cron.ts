import { Trigger } from '../../models/trigger.interface';
import { CronInterface } from './cron.interface';

export class Cron implements Trigger<CronInterface> {

  private static _instance: Cron;

  private constructor() {
  }

  public static getInstance() {
    if (!Cron._instance) {
      Cron._instance = new Cron();
    }
    return Cron._instance;
  }

  async setup(options: CronInterface): Promise<boolean> {
    await options.queue.add({}, { repeat: { cron: options.cronString } });
    return Promise.resolve(true);
  }


}
