import {
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '../types';

import { status } from '@grpc/grpc-js';

export function wrapCallObjectForRouter(call: any): ParsedRouterRequest {
  return {
    request: {
      params: call.request,
      path: '',
      headers: {},
      context: {},
    },
  };
}

export function wrapRouterGrpcFunction(
  fun: (call: ParsedRouterRequest) => Promise<UnparsedRouterResponse>
): (call: any, callback: any) => void {
  return (call: any, callback: any) => {
    let requestReceive = Date.now();
    try {
      if (typeof call.request.context === 'string' && call.request.context.length !== 0) {
        call.request.context = JSON.parse(call.request.context);
      } else if (typeof call.request.context === 'string') {
        call.request.context = {};
      }
      if (typeof call.request.params === 'string' && call.request.params.length !== 0) {
        call.request.params = JSON.parse(call.request.params);
      } else if (typeof call.request.params === 'string') {
        call.request.params = {};
      }
      if (typeof call.request.headers === 'string' && call.request.headers.length !== 0) {
        call.request.headers = JSON.parse(call.request.headers);
      } else if (typeof call.request.headers === 'string') {
        call.request.headers = {};
      }
    } catch (e) {
      console.log(
        'Request: ' +
          call.request.path +
          ' ' +
          status.INTERNAL +
          ' ' +
          (Date.now() - requestReceive)
      );
      console.log(e.message ?? 'Something went wrong');
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
        console.log(
          'Request: ' + call.request.path + ' 200 ' + (Date.now() - requestReceive)
        );
      })
      .catch((error) => {
        console.log(
          'Request: ' + call.request.path + ' ' + error.code ??
            status.INTERNAL + ' ' + (Date.now() - requestReceive)
        );
        console.log(error.message ?? 'Something went wrong');
        callback({
          code: error.code ?? status.INTERNAL,
          message: error.message ?? 'Something went wrong',
        });
      });
  };
}
