import { Context, Cookies, Params, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';

export function createParsedRouterRequest(
  params: Params,
  urlParams?: Params,
  queryParams?: Params,
  bodyParams?: Params,
  path?: string,
  headers?: Headers,
  context?: Context,
  cookies?: Cookies,
  rawHeaders?: string[],
  rawBody?: Buffer,
): ParsedRouterRequest {
  return <ParsedRouterRequest>{
    request: {
      params,
      urlParams: urlParams ?? {},
      queryParams: queryParams ?? {},
      bodyParams: bodyParams ?? {},
      path: path ?? '',
      headers: headers,
      rawHeaders: rawHeaders ?? [],
      rawBody: rawBody ?? Buffer.alloc(0),
      context: context ?? {},
      cookies: cookies ?? {},
    },
  };
}
