import { NextFunction, Request, Response } from 'express';
import { RouteTrie } from './RouteTrie.js';
import { Histogram } from 'prom-client';

export function instrumentationMiddleware(routeTrie: RouteTrie, histogram?: Histogram) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!histogram) {
      return next();
    }
    const start = process.hrtime();
    let path = req.path;
    const method = req.method.toUpperCase();
    const matchedRoute = routeTrie.match(method, path);
    if (matchedRoute) {
      path = matchedRoute;
    }

    res.on('finish', () => {
      const duration = process.hrtime(start);
      const durationInSeconds = duration[0] + duration[1] / 1e9;

      histogram
        .labels(method, path, res.statusCode.toString())
        .observe(durationInSeconds);
    });

    next();
  };
}
