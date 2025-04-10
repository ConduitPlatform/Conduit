import {
  ConduitGrpcSdk,
  Indexable,
  ParsedRouterRequest,
  ParsedSocketRequest,
  UnparsedRouterResponse,
  UnparsedSocketResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Status } from '@grpc/grpc-js/build/src/constants.js';

export type RouterRequestHandler = (
  call: ParsedRouterRequest,
) => Promise<UnparsedRouterResponse>;
export type RouterRequestHandlerCallback = (
  call: ParsedRouterRequest,
  callback: (response: UnparsedRouterResponse) => void,
) => Promise<UnparsedRouterResponse | undefined | void>;
export type SocketRequestHandler = (
  call: ParsedSocketRequest,
) => Promise<UnparsedSocketResponse>;
export type SocketRequestHandlerCallback = (
  call: ParsedSocketRequest,
  callback: (response: UnparsedRouterResponse) => void,
) => Promise<UnparsedSocketResponse | undefined | void>;
export type RequestHandlers =
  | RouterRequestHandler
  | RouterRequestHandlerCallback
  | SocketRequestHandler
  | SocketRequestHandlerCallback;

const mapGrpcStatusToHttp = (code?: number): string => {
  if (!code) return '200 (OK)';
  switch (code) {
    case status.OK:
      return `200 (OK)`;
    case status.CANCELLED:
      return `499 (Cancelled)`;
    case status.INVALID_ARGUMENT:
      return `400 (Invalid Argument)`;
    case status.DEADLINE_EXCEEDED:
      return `504 (Deadline Exceeded)`;
    case status.NOT_FOUND:
      return `404 (Not Found)`;
    case status.ALREADY_EXISTS:
      return `409 (Already Exists)`;
    case status.PERMISSION_DENIED:
      return `403 (Permission Denied)`;
    case status.UNAUTHENTICATED:
      return `401 (Unauthenticated)`;
    case status.OUT_OF_RANGE:
      return `416 (Out of Range)`;
    case status.FAILED_PRECONDITION:
      return `412 (Failed Precondition)`;
    case status.ABORTED:
      return `409 (Aborted)`;
    case status.INTERNAL:
      return `416 (Internal)`;
    case status.UNAVAILABLE:
      return `503 (Service Unavailable)`;
    case status.DATA_LOSS:
      return `500 (Data Loss)`;
    default:
      return `500 (Unknown)`;
  }
};

function generateLog(
  routerType: string,
  routerRequest: boolean,
  requestReceive: number,
  call: Indexable,
  status?: Status,
) {
  let log = '';
  const latency = Date.now() - requestReceive;
  if (routerRequest) {
    log += `(${routerType}) Request: ${call.request.path}`;
  } else {
    log += `(${routerType})  Socket: ${call.request.event} socket: ${call.request.socket}`;
  }
  log += ` ${mapGrpcStatusToHttp(status) ?? '200'} ${latency}ms`;

  ConduitGrpcSdk.Logger.log(log);
  ConduitGrpcSdk.Metrics?.set('grpc_request_latency_seconds', latency / 1000);
  ConduitGrpcSdk.Metrics?.set(
    `${routerType}_grpc_request_latency_seconds`,
    latency / 1000,
  );

  const successStatus = !status || status.toString().startsWith('2');
  ConduitGrpcSdk.Metrics?.increment(`${routerType}_grpc_response_statuses_total`, 1, {
    success: successStatus ? 'true' : 'false',
  });
}

function parseRequestData(data?: string) {
  if (data && data.length !== 0) {
    return JSON.parse(data);
  } else {
    return {};
  }
}

function parseResponseData(
  r: any,
  routerRequest: boolean,
  requestReceive: number,
  call: any,
  callback: any,
  responded: { did: boolean },
  routerType: string,
) {
  if (responded.did) return;
  responded.did = true;
  if (!r) {
    callback({
      code: status.INTERNAL,
      message: 'Handler did not return a response',
    });
  }
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
          result: r.result
            ? typeof r.result === 'string'
              ? r.result
              : JSON.stringify(r.result)
            : undefined,
        });
      } else {
        callback(null, { ...respObject, result: JSON.stringify(r) });
      }
    }
  } else {
    if (r.hasOwnProperty('data')) r.data = JSON.stringify(r.data);
    callback(null, r);
  }
  generateLog(routerType, routerRequest, requestReceive, call, undefined);
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
      call.request.urlParams = parseRequestData(call.request.urlParams);
      call.request.queryParams = parseRequestData(call.request.queryParams);
      call.request.bodyParams = parseRequestData(call.request.bodyParams);

      routerRequest = !call.request.hasOwnProperty('event');
      if (routerRequest) {
        call.request.headers = parseRequestData(call.request.headers);
      }
    } catch (e) {
      ConduitGrpcSdk.Metrics?.increment(`${routerType}_grpc_errors_total`);
      generateLog(routerType, routerRequest, requestReceive, call, status.INTERNAL);
      ConduitGrpcSdk.Logger.error((e as Error).message ?? 'Something went wrong');
      return callback({
        code: status.INTERNAL,
        message: (e as Error).message ?? 'Something went wrong',
      });
    }

    const responded = { did: false };
    fun(call, r => {
      parseResponseData(
        r,
        routerRequest,
        requestReceive,
        call,
        callback,
        responded,
        routerType,
      );
    })
      .then(r =>
        parseResponseData(
          r,
          routerRequest,
          requestReceive,
          call,
          callback,
          responded,
          routerType,
        ),
      )
      .catch(error => {
        ConduitGrpcSdk.Metrics?.increment(`${routerType}_grpc_errors_total`);
        generateLog(
          routerType,
          routerRequest,
          requestReceive,
          call,
          error.code ?? status.INTERNAL,
        );
        ConduitGrpcSdk.Logger.error(error.message ?? 'Something went wrong');
        callback({
          code: error.code ?? status.INTERNAL,
          message: error.details ?? error.message ?? 'Something went wrong',
        });
      });
  };
}
