import { Provider } from '../utils/getEmailStatus.js';

export interface IJobData {
  messageId: string;
  emailRecId: string;
  retries: number;
  provider: Provider;
}
