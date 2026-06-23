import { NextFunction, Response } from 'express';
import { ConduitRequest } from '@conduitplatform/hermes';
import { ReadinessService } from './ReadinessService.js';
import { sendLiveResponse, sendReadyResponse } from './response.js';

export function getReadinessMiddleware(getService: () => ReadinessService) {
  return async function readinessMiddleware(
    req: ConduitRequest,
    res: Response,
    next: NextFunction,
  ) {
    if (req.method !== 'GET') return next();

    if (req.path === '/live') {
      sendLiveResponse(req, res);
      return;
    }

    if (req.path === '/ready') {
      const report = await getService().evaluate();
      sendReadyResponse(req, res, report);
      return;
    }

    next();
  };
}
