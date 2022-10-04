import { ConduitSocketEvent, ConduitSocketOptions } from './Socket';

export interface ConduitSocket {
  readonly _input: ConduitSocketOptions;
  events: Record<string, ConduitSocketEvent>;
}
