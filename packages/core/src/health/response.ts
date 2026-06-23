import type { Request, Response } from 'express';
import type { ReadinessReport } from './types.js';

export const LEGACY_READY_MESSAGE = 'Conduit Core is online!';
export const LEGACY_NOT_READY_MESSAGE = 'Conduit Core is not ready';

export function wantsLegacyResponse(req: Request): boolean {
  if (req.query.legacy === 'true') return true;
  const accept = req.headers.accept;
  if (!accept || typeof accept !== 'string') return false;
  if (accept.includes('application/json')) return false;
  return accept.includes('text/plain') || accept.includes('*/*');
}

export function sendReadyResponse(
  req: Request,
  res: Response,
  report: ReadinessReport,
): void {
  const httpStatus = report.status === 'ready' ? 200 : 503;
  if (wantsLegacyResponse(req)) {
    const body =
      report.status === 'ready' ? LEGACY_READY_MESSAGE : LEGACY_NOT_READY_MESSAGE;
    res.status(httpStatus).type('text/plain').send(body);
    return;
  }
  res.status(httpStatus).json(report);
}

export function sendLiveResponse(req: Request, res: Response): void {
  const payload = { status: 'alive', message: 'Conduit Core is alive' };
  if (wantsLegacyResponse(req)) {
    res.status(200).type('text/plain').send(LEGACY_READY_MESSAGE);
    return;
  }
  res.status(200).json(payload);
}
