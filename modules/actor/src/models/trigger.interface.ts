import { Queue } from 'bull';

export interface TriggerOptions{
  jobName: string;
  queue: Queue
}
export interface Trigger<T extends TriggerOptions > {
  setup(options: T): PromiseLike<boolean>;
}
