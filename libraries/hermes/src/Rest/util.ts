import { Request } from 'express';
import {
  BodyParams,
  ConduitError,
  Indexable,
  Params,
  QueryParams,
  UrlParams,
} from '@conduitplatform/grpc-sdk';
import { ZodParser } from '../classes/ZodParser.js';

type ConduitRequest = Request & { conduit?: Indexable };

export function extractRequestData(req: ConduitRequest) {
  const context = req.conduit || {};
  const urlParams: UrlParams = {};
  const queryParams: QueryParams = {};
  const bodyParams: BodyParams = {};
  const headers = req.headers;
  const cookies = req.cookies;
  if (req.query) {
    const newObj = {};
    Object.keys(req.query).forEach((k: string) => {
      let fieldName = k.indexOf('[]') !== -1 ? k.split('[]')[0] : k;
      // @ts-ignore
      if (!Array.isArray(req.query) && req.query[k].indexOf(',') !== -1) {
        // @ts-ignore
        newObj[fieldName] = req.query[k].split(',');
      } else {
        // @ts-ignore
        newObj[fieldName] = req.query[k];
      }
    });
    Object.assign(queryParams, newObj);
  }

  if (req.body) {
    Object.assign(bodyParams, req.body);
  }

  if (req.params) {
    Object.assign(urlParams, req.params);
  }

  if (queryParams.populate) {
    if (typeof queryParams.populate === 'string' && queryParams.populate.includes(',')) {
      queryParams.populate = queryParams.populate.split(',');
    } else if (!Array.isArray(queryParams.populate)) {
      queryParams.populate = [queryParams.populate];
    }
  }
  const path = req.baseUrl + req.path;
  return { context, headers, cookies, path, urlParams, queryParams, bodyParams };
}

export function validateParams(
  params: Params,
  routeDefinedParams: Params,
  options: { strict?: boolean; coerce?: boolean } = {},
): Params {
  const { strict = true, coerce = false } = options;
  const parser = new ZodParser();
  const schema = parser.buildZodSchema(routeDefinedParams as Record<string, unknown>, {
    strict,
    coerce,
  });
  const result = schema.safeParse(params);
  if (!result.success) {
    const message = result.error.issues
      .map(issue => {
        const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
        return path + issue.message;
      })
      .join('; ');
    throw ConduitError.userInput(message);
  }
  return result.data as Params;
}

export function mapGrpcErrorToHttp(gRPCErrorCode: number): {
  name: string;
  status: number;
} {
  switch (gRPCErrorCode) {
    case 3:
      return { name: 'INVALID_ARGUMENTS', status: 400 };
    case 5:
      return { name: 'NOT_FOUND', status: 404 };
    // TODO: Enable this case once conflict error handling is implemented. Currently commented out to avoid introducing a breaking change.
    // case 6:
    //   return { name: 'CONFLICT', status: 409 };
    case 7:
      return { name: 'FORBIDDEN', status: 403 };
    case 16:
      return { name: 'UNAUTHORIZED', status: 401 };
    default:
      return { name: 'INTERNAL_SERVER_ERROR', status: 500 };
  }
}
