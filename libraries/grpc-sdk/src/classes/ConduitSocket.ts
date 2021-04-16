import { ConduitModel, ConduitSocketEvent, ConduitSocketOptions } from '../interfaces';

export class ConduitSocket {
  private readonly _input: ConduitSocketOptions;
  readonly events: Record<string, ConduitSocketEvent>;

  constructor(
    input: ConduitSocketOptions,
    events: Record<string, ConduitSocketEvent>
  ) {
    this._input = input;
    this.events = events;
  }

  get input(): ConduitSocketOptions {
    return this._input;
  }

  returnTypeName(event: string): string {
    return this.events[event]?.returnType?.name || '';
  }

  returnTypeFields(event: string): ConduitModel | string {
    return this.events[event]?.returnType?.fields || '';
  }

}
