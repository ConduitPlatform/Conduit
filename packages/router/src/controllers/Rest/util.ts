import { Request } from "express";
export function extractRequestData(req: Request) {
  const context = (req as any).conduit;
  let params: any = {};
  let headers: any = req.headers;
  if (req.query) {
    Object.assign(params, req.query);
  }

  if (req.body) {
    Object.assign(params, req.body);
  }

  if (req.params) {
    Object.assign(params, req.params);
  }

  if (params.populate) {
    if (params.populate.includes(",")) {
      params.populate = params.populate.split(",");
    } else {
      params.populate = [params.populate];
    }
  }
  let path = req.baseUrl + req.path;
  return { context, params, headers, path };
}
