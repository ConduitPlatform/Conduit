import {
  ParsedRouterRequest,
  RouterRequest,
  RouterResponse,
  UnparsedRouterResponse,
} from '../types';

import { status } from '@grpc/grpc-js';

export function wrapCallObjectForRouter(call: any): RouterRequest {
  return {
    request: {
      params: JSON.stringify(call.request),
      path: '',
      headers: '',
      context: '',
    },
  };
}

export function wrapCallbackFunctionForRouter(callback: any): RouterResponse {
  return (err, res) => {
    if (err || !res) {
      return callback(err);
    }

    if (res.hasOwnProperty('result')) {
      // @ts-ignore
      return callback(null, JSON.parse(res.result));
    }

    callback(null, null);
  };
}

export function wrapRouterGrpcFunction(
  fun: (call: ParsedRouterRequest) => Promise<UnparsedRouterResponse>
): (call: any, callback: any) => void {
  return (call: any, callback: any) => {
    try {
      if (typeof call.request.context === 'string') {
        call.request.context = JSON.parse(call.request.context);
      }
      if (typeof call.request.params === 'string') {
        call.request.params = JSON.parse(call.request.params);
      }
      if (typeof call.request.headers === 'string') {
        call.request.headers = JSON.parse(call.request.headers);
      }
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong',
      });
    }
    fun(call)
      .then((r) => {
        if (!r) return;
        if (typeof r === 'string') {
          callback(null, { result: r });
        } else {
          if (r.result) {
            callback(null, { result: JSON.stringify(r.result) });
          } else if (r.redirect) {
            callback(null, { redirect: r.redirect, result: r.result ?? undefined });
          } else {
            callback(null, { result: JSON.stringify(r) });
          }
        }
      })
      .catch((error) => {
        callback({
          code: error.code ?? status.INTERNAL,
          message: error.message ?? 'Something went wrong',
        });
      });
  };
}
