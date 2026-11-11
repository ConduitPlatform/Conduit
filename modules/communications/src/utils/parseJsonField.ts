import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

/** JSON.parse for request fields: unparsable input becomes INVALID_JSON_PAYLOAD. */
export function parseJsonField(value: string) {
  try {
    return JSON.parse(value);
  } catch (e) {
    throw new ModuleError(errors.INVALID_JSON_PAYLOAD, (e as Error).message);
  }
}
