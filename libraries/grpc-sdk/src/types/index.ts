export type GrpcRequest<T> = { request: T };
export type GrpcResponse<T> = (
  err: {
    code: number,
    message: string
  } | null,
  res?: T,
) => void;

export type RouterRequest = GrpcRequest<{
  params: string,
  path: string,
  headers: string,
  context: string
}>;

type Response = { result: string, redirect: string };
type ResponseWithResult = { result: string };
type ResponseWithRedirect = { redirect: string };

export type RouterResponse = GrpcResponse<Response | ResponseWithResult | ResponseWithRedirect>;

export type SetConfigRequest = GrpcRequest<{ newConfig: string }>;
export type SetConfigResponse = GrpcResponse<{ updatedConfig: string }>;

export type SocketRequest = GrpcRequest<{
  event: string,
  socketId: string,
  params: string,
  context: string
}>;

type EventResponse = {
  event: string,
  data: string,
  receivers?: string[]
};

type JoinRoomResponse = {
  rooms: string[]
}

export type SocketResponse = GrpcResponse<EventResponse | JoinRoomResponse>;
