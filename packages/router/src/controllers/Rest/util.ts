import { Request } from 'express';

export function extractRequestData(req: Request) {
  const context = (req as any).conduit || {};
  let params: any = {};
  let headers: any = req.headers;
  if (req.query) {
    let newObj = {};
    Object.keys(req.query).forEach((k: string) => {
      if (!req.query.hasOwnProperty(k)) return;
      // @ts-ignore
      if (!Array.isArray(req.query) && req.query[k].indexOf(',') !== -1) {
        // @ts-ignore
        newObj[k] = req.query[k].split(',');
      } else {
        // @ts-ignore
        newObj[k] = req.query[k];
      }
    });
    Object.assign(params, newObj);
  }

  if (req.body) {
    Object.assign(params, req.body);
  }

  if (req.params) {
    Object.assign(params, req.params);
  }

  if (params.populate) {
    if (params.populate.includes(',')) {
      params.populate = params.populate.split(',');
    } else {
      params.populate = [params.populate];
    }
  }
  let path = req.baseUrl + req.path;
  return { context, params, headers, path };
}
