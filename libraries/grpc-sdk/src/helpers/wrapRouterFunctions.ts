import {
  ParsedRouterRequest,
  ParsedSocketRequest,
  UnparsedRouterResponse,
  UnparsedSocketResponse,
} from '../types';

import { status } from '@grpc/grpc-js';
import { Status } from '@grpc/grpc-js/build/src/constants';
import { Indexable } from '../interfaces';
import ConduitGrpcSdk from '../index';

export type RouterRequestHandler = (
  call: ParsedRouterRequest,
) => Promise<UnparsedRouterResponse>;
export type SocketRequestHandler = (
  call: ParsedSocketRequest,
) => Promise<UnparsedSocketResponse>;
export type RequestHandlers = RouterRequestHandler | SocketRequestHandler;

export function wrapCallObjectForRouter(call: Indexable): ParsedRouterRequest {
  return {
    request: {
      params: call.request,
      path: '',
      headers: {},
      context: {},
    },
  };
}

function generateLog(
  routerRequest: boolean,
  requestReceive: number,
  call: Indexable,
  status?: Status,
) {
  let log = '';
  if (routerRequest) {
    log += `Request: ${call.request.path}`;
  } else {
    log += `Socket: ${call.request.event} socket: ${call.request.socket}`;
  }
  log += ` ${status ?? '200'} ${Date.now() - requestReceive}`;

  ConduitGrpcSdk.Logger.log(log);
}

function parseRequestData(data: string) {
  if (typeof data === 'string' && data.length !== 0) {
    return JSON.parse(data);
  } else if (typeof data === 'string') {
    return {};
  }
}

export function wrapRouterGrpcFunction(
  fun: RequestHandlers,
  routerType: string,
): (call: Indexable, callback: any) => void {
  return (call: any, callback: any) => {
    const requestReceive = Date.now();
    let routerRequest = true;
    ConduitGrpcSdk.Metrics.increment(`${routerType}_http_requests`);
    try {
      call.request.context = parseRequestData(call.request.context);
      call.request.params = parseRequestData(call.request.params);

      routerRequest = !call.request.hasOwnProperty('event');
      if (routerRequest) {
        call.request.headers = parseRequestData(call.request.headers);
      }
    } catch (e) {
      generateLog(routerRequest, requestReceive, call, status.INTERNAL);
      ConduitGrpcSdk.Logger.error((e as Error).message ?? 'Something went wrong');
      return callback({
        code: status.INTERNAL,
        message: (e as Error).message ?? 'Something went wrong',
      });
    }

    fun(call)
      .then(r => {
        if (!r) return;
        if (routerRequest) {
          if (typeof r === 'string') {
            callback(null, { result: r });
          } else {
            let respObject;
            if (r.removeCookies || r.setCookies) {
              respObject = {
                removeCookies: r.removeCookies,
                setCookies: r.setCookies,
              };
            }
            if (r.result || r.redirect) {
              callback(null, {
                ...respObject,
                redirect: r.redirect ?? undefined,
                result: r.result ? JSON.stringify(r.result) : undefined,
              });
            } else {
              callback(null, { ...respObject, result: JSON.stringify(r) });
            }
          }
        } else {
          if (r.hasOwnProperty('data')) (r as any).data = JSON.stringify((r as any).data);
          callback(null, r);
        }
        generateLog(routerRequest, requestReceive, call, undefined);
      })
      .catch(error => {
        generateLog(routerRequest, requestReceive, call, error.code ?? status.INTERNAL);
        ConduitGrpcSdk.Logger.error(error.message ?? 'Something went wrong');
        callback({
          code: error.code ?? status.INTERNAL,
          message: error.message ?? 'Something went wrong',
        });
      });
  };
}
