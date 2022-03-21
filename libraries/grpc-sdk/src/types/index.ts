import { status } from '@grpc/grpc-js';

export type GrpcRequest<T> = { request: T };
export type GrpcResponse<T> = (
  err: {
    code: number;
    message: string;
  } | null,
  res?: T,
) => void;

export class GrpcError extends Error {
  code: status;
  message: string;

  constructor(code: status, message: string) {
    super(message);
    this.code = code;
    this.message = message;
  }
}

export type RouterRequest = GrpcRequest<{
  params: string;
  path: string;
  headers: string;
  context: string;
}>;
export type ParsedRouterRequest = GrpcRequest<{
  params: { [key: string]: any };
  path: string;
  headers: { [key: string]: any };
  context: { [key: string]: any };
}>;

export type UnparsedRouterResponse =
  | { result?: { [key: string]: any }; redirect?: string }
  | { [key: string]: any }
  | string;

type Response = { result: string; redirect: string };
type ResponseWithResult = { result: string };
type ResponseWithRedirect = { redirect: string };

export type RouterResponse = GrpcResponse<Response | ResponseWithResult | ResponseWithRedirect>;

export type SetConfigRequest = GrpcRequest<{ newConfig: string }>;
export type SetConfigResponse = GrpcResponse<{ updatedConfig: string }>;

export type SocketRequest = GrpcRequest<{
  event: string;
  socketId: string;
  params: string;
  context: string;
}>;
export type ParsedSocketRequest = GrpcRequest<{
  event: string;
  socketId: string;
  params: { [key: string]: any };
  context: { [key: string]: any };
}>;
export type UnparsedSocketResponse =
  | {
  event: string;
  data: { [key: string]: any };
  receivers?: string[];
}
  | {
  rooms: string[];
}

type EventResponse = {
  event: string;
  data: string;
  receivers?: string[];
};

type JoinRoomResponse = {
  rooms: string[];
};

export type SocketResponse = GrpcResponse<EventResponse | JoinRoomResponse>;
