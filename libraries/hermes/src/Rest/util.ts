import {
  BodyParams,
  ConduitError,
  grpcStatusToHttp,
  Params,
  QueryParams,
  UrlParams,
} from '@conduitplatform/grpc-sdk';
import { ZodParser } from '../classes/ZodParser.js';
import { HermesErrorCodes } from '../utils/errors.js';
import { Response } from 'express';
import { ConduitRequest } from '../interfaces/ConduitRequest.js';

export function captureRequestRawBody(req: ConduitRequest, _res: Response, buf: Buffer) {
  req.rawBody = buf;
}

export function sanitizeRawHeaders(
  rawHeaders: string[] | undefined,
  parsedHeaders: Record<string, string | string[] | undefined>,
): string[] {
  if (!rawHeaders?.length) return [];
  const result: string[] = [];
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i];
    const value = rawHeaders[i + 1];
    if (key && parsedHeaders[key.toLowerCase()] !== undefined) {
      result.push(key, value);
    }
  }
  return result;
}

export function extractRequestData(req: ConduitRequest) {
  const context = req.conduit || {};
  const urlParams: UrlParams = {};
  const queryParams: QueryParams = {};
  const bodyParams: BodyParams = {};
  const headers = req.headers;
  const cookies = req.cookies;
  const rawHeaders = sanitizeRawHeaders(req.rawHeaders, req.headers);
  const rawBody = req.rawBody;
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
  return {
    context,
    headers,
    rawHeaders,
    rawBody,
    cookies,
    path,
    urlParams,
    queryParams,
    bodyParams,
  };
}

export function validateParams(
  params: Params,
  routeDefinedParams: Params,
  options: { unknownKeys?: 'strict' | 'strip' | 'passthrough'; coerce?: boolean } = {},
): Params {
  const { unknownKeys = 'strip', coerce = false } = options;
  const parser = new ZodParser();
  const schema = parser.buildZodSchema(routeDefinedParams as Record<string, unknown>, {
    unknownKeys,
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
    throw new ConduitError(
      'USER_INPUT_ERROR',
      400,
      message,
      HermesErrorCodes.INVALID_PARAMETERS,
    );
  }
  return result.data as Params;
}

/** HTTP status and error name a gRPC status is served as. */
export function mapGrpcErrorToHttp(gRPCErrorCode: number): {
  name: string;
  status: number;
} {
  return grpcStatusToHttp(gRPCErrorCode);
}
