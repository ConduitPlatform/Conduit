import { Context, Cookies, Indexable, Params } from './Indexable.js';
import { GrpcRequest } from '../types/index.js';

export type ParsedRouterRequest = GrpcRequest<{
  params: Params;
  urlParams: Params;
  queryParams: Params;
  bodyParams: Params;
  path: string;
  headers: Headers & { authorization?: string };
  context: Context;
  cookies: Cookies;
}>;

export type UnparsedRouterResponse =
  | {
      result?: Indexable;
      redirect?: string;
      setCookies: Cookies[];
      removeCookies: Cookies[];
    }
  | Indexable
  | string;

export type ParsedSocketRequest = GrpcRequest<{
  event: string;
  socketId: string;
  params: (string | Indexable)[];
  context: Context;
  cookies: Cookies;
}>;

type EventResponse = {
  event: string;
  data: Indexable;
  receivers?: string[];
  rooms?: string[];
};

export type UnparsedSocketResponse = EventResponse | JoinRoomResponse;
type JoinRoomResponse = {
  rooms: string[];
};
