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

/**
 * Answers an unexpected failure of an admin middleware with an opaque 500. The cause
 * (which may hold connection details) is logged by the caller and never sent to what
 * can be an unauthenticated client.
 */
export function sendInternalError(res: Response) {
  const body = toErrorResponse(undefined);
  return res.status(body.status).json(body);
}
