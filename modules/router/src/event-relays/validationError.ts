import type { ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';

/**
 * Validation failure of an event relay input, payload or template. `message` is the
 * specific validator text; `definition` is the catalog entry that identifies it
 * (`conduitCode`), so the boundaries can turn it into a typed error.
 */
export class EventRelayValidationError extends Error {
  readonly definition: ModuleErrorDefinition;

  constructor(definition: ModuleErrorDefinition, message: string = definition.message) {
    super(message);
    this.name = 'EventRelayValidationError';
    this.definition = definition;
  }

  get conduitCode(): string {
    return this.definition.conduitCode;
  }

  /** Typed definition carrying the specific validator text as client-visible message. */
  toDefinition(): ModuleErrorDefinition {
    return { ...this.definition, message: this.message };
  }
}
