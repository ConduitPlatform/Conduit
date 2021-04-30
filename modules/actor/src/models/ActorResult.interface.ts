import { Actor } from './ActorInput.interface';

export interface ActorResult {
  data: { goTo: Actor } | { [key: string]: any };
  message: string;
  code: number;
  success: boolean;
}
