import { Context, Cookies, Headers, Indexable, Params } from '../../interfaces';
import { GrpcRequest } from '../../types';

export type ParsedRouterRequest = GrpcRequest<{
  params: Params;
  urlParams: Params;
  queryParams: Params;
  bodyParams: Params;
  path: string;
  headers: Headers;
  context: Context;
  cookies: Cookies;
}>;

export type UnparsedRouterResponse =
  | {
      result?: Indexable;
      redirect?: string;
      setCookies: Indexable;
      removeCookies: Indexable;
    }
  | Indexable
  | string;

export type ParsedSocketRequest = GrpcRequest<{
  event: string;
  socketId: string;
  params: string[];
  context: Context;
  cookies: Cookies;
}>;

type EventResponse = {
  event: string;
  data: Indexable;
  receivers?: string[];
};

export type UnparsedSocketResponse = EventResponse | JoinRoomResponse;
type JoinRoomResponse = {
  rooms: string[];
};
