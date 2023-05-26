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
): ParsedRouterRequest {
  return <ParsedRouterRequest>{
    request: {
      params,
      urlParams: urlParams ?? {},
      queryParams: queryParams ?? {},
      bodyParams: bodyParams ?? {},
      path: path ?? '',
      headers: headers,
      context: context ?? {},
      cookies: cookies ?? {},
    },
  };
}
