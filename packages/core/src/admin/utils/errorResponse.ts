import type { Response } from 'express';
import { toErrorResponse } from '@conduitplatform/hermes';
import { ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';

/** Answers an express-level admin middleware failure with the standard error body. */
export function sendError(
  res: Response,
  definition: ModuleErrorDefinition,
  debugLogInfo?: string,
) {
  const body = toErrorResponse(new ModuleError(definition, debugLogInfo));
  return res.status(body.status).json(body);
}
