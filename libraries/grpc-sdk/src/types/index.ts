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

export type ParsedRouterRequest = GrpcRequest<{
  params: { [key: string]: any };
  path: string;
  headers: { [key: string]: any };
  context: { [key: string]: any };
}>;

export type UnparsedRouterResponse =
  | { result?: { [key: string]: any }; redirect?: string, setCookies: { [key: string]: any }, removeCookies: string[], cookieOptions: { [key: string]: any } }
  | { [key: string]: any }
  | string;

export type SetConfigRequest = GrpcRequest<{ newConfig: string }>;
export type SetConfigResponse = GrpcResponse<{ updatedConfig: string }>;

export type ParsedSocketRequest = GrpcRequest<{
  event: string;
  socketId: string;
  params: any[];
  context: { [key: string]: any };
}>;

type EventResponse = {
  event: string;
  data: { [key: string]: any };
  receivers?: string[];
};

type JoinRoomResponse = {
  rooms: string[];
};
export type UnparsedSocketResponse = EventResponse | JoinRoomResponse;
