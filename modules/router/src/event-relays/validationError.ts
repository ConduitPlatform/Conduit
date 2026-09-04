export class EventRelayValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventRelayValidationError';
  }
}
