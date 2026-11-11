import {
  ConduitGrpcSdk,
  ConduitRouteReturnDefinition,
  INTERNAL_ERROR_CODE,
  ConduitSocketParamTypes,
  Indexable,
  ParsedRouterRequest,
  ParsedSocketRequest,
  UnparsedRouterResponse,
  UnparsedSocketResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { hydrateContextUser, shouldHydrateUser, UserHydrator } from './hydrateUser.js';
import { Status } from '@grpc/grpc-js/build/src/constants.js';
import { toGrpcStatus } from '../helpers/toGrpcStatus.js';

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
  callback: (response: UnparsedSocketResponse) => void,
) => Promise<UnparsedSocketResponse | undefined | void>;
export type RequestHandlers = RouterRequestHandler | RouterRequestHandlerCallback;
export type SocketRequestHandlers = SocketRequestHandler | SocketRequestHandlerCallback;
export interface SocketEventHandler {
  params?: ConduitSocketParamTypes;
  returnType?: ConduitRouteReturnDefinition;
  handler: SocketRequestHandlers;
}

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
      return `400 (Out of Range)`;
    case status.RESOURCE_EXHAUSTED:
      return `429 (Resource Exhausted)`;
    case status.UNIMPLEMENTED:
      return `501 (Unimplemented)`;
    case status.FAILED_PRECONDITION:
      return `412 (Failed Precondition)`;
    case status.ABORTED:
      return `409 (Aborted)`;
    case status.INTERNAL:
      return `500 (Internal)`;
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
    const socketReq = call.request as {
      event: string;
      socketId?: string;
      socket?: string;
    };
    const socketLabel = socketReq.socketId ?? socketReq.socket;
    log += `(${routerType})  Socket: ${socketReq.event} socket: ${socketLabel}`;
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
    generateLog(routerType, routerRequest, requestReceive, call, status.INTERNAL);
    return callback({
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
  fun: RequestHandlers | SocketRequestHandlers,
  routerType: string,
  hydration?: { options: Indexable; hydrator: UserHydrator },
  declaredErrors?: ReadonlySet<string>,
): (call: Indexable, callback: any) => void {
  // Admin routes are operator-facing and keep the cause of unexpected failures; client
  // routes never expose it.
  const maskUnknown = routerType !== 'admin';
  const reportedUndeclared = new Set<string>();
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
        call.request.rawHeaders = call.request.rawHeaders
          ? JSON.parse(call.request.rawHeaders)
          : [];
        if (call.request.rawBody && !Buffer.isBuffer(call.request.rawBody)) {
          call.request.rawBody = Buffer.from(call.request.rawBody);
        } else if (!call.request.rawBody) {
          call.request.rawBody = Buffer.alloc(0);
        }
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
    const invoke = () =>
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
      });
    // Session-mode requests already carry context.user, so this is a no-op for them.
    const needsHydration =
      hydration && shouldHydrateUser(hydration.options, call.request.context);
    (needsHydration
      ? hydrateContextUser(
          hydration!.options,
          call.request.context,
          hydration!.hydrator,
        ).then(invoke)
      : invoke()
    )
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
        const { code, message, conduitCode, log } = toGrpcStatus(error, { maskUnknown });
        generateLog(routerType, routerRequest, requestReceive, call, code);
        ConduitGrpcSdk.Logger.error(log);
        if (
          declaredErrors &&
          conduitCode &&
          conduitCode !== INTERNAL_ERROR_CODE &&
          !declaredErrors.has(conduitCode) &&
          !reportedUndeclared.has(conduitCode)
        ) {
          // Keeps the published error list of a route honest: once per route and code.
          reportedUndeclared.add(conduitCode);
          ConduitGrpcSdk.Logger.warn(
            `Route ${call.request.path ?? ''} returned ${conduitCode}, which is missing from its "errors" option`,
          );
        }
        callback({ code, message });
      });
  };
}
