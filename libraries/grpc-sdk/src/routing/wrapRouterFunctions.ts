import {
  ParsedRouterRequest,
  ParsedSocketRequest,
  UnparsedRouterResponse,
  UnparsedSocketResponse,
} from './interfaces';

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

function generateLog(
  routerRequest: boolean,
  requestReceive: number,
  call: Indexable,
  status?: Status,
) {
  let log = '';
  const latency = Date.now() - requestReceive;
  if (routerRequest) {
    log += `Request: ${call.request.path}`;
  } else {
    log += `Socket: ${call.request.event} socket: ${call.request.socket}`;
  }
  log += ` ${status ?? '200'} ${latency}`;

  ConduitGrpcSdk.Logger.log(log);
  ConduitGrpcSdk.Metrics?.set('grpc_request_latency_seconds', latency / 1000);

  const successStatus = !status || status.toString().charAt(0) === '2';
  ConduitGrpcSdk.Metrics?.increment('grpc_response_statuses_total', 1, {
    success: successStatus ? 'true' : 'false',
  });
}

function parseRequestData(data: string) {
  if (data.length !== 0) {
    return JSON.parse(data);
  } else {
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
    ConduitGrpcSdk.Metrics?.increment(`${routerType}_grpc_requests_total`);
    try {
      call.request.context = parseRequestData(call.request.context);
      call.request.params = parseRequestData(call.request.params);
      call.request.cookies = parseRequestData(call.request.cookies);

      routerRequest = !call.request.hasOwnProperty('event');
      if (routerRequest) {
        call.request.headers = parseRequestData(call.request.headers);
      }
    } catch (e) {
      ConduitGrpcSdk.Metrics?.increment(`${routerType}_grpc_errors_total`);
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
        ConduitGrpcSdk.Metrics?.increment(`${routerType}_grpc_errors_total`);
        generateLog(routerRequest, requestReceive, call, error.code ?? status.INTERNAL);
        ConduitGrpcSdk.Logger.error(error.message ?? 'Something went wrong');
        callback({
          code: error.code ?? status.INTERNAL,
          message: error.message ?? 'Something went wrong',
        });
      });
  };
}
