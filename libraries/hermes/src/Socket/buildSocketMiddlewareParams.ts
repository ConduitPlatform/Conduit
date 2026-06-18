import type { ConduitRouteParameters, Indexable } from '@conduitplatform/grpc-sdk';
import type { Socket } from 'socket.io';

export type SocketMiddlewareParams = ConduitRouteParameters & {
  context: Indexable;
};

function formatBearerToken(token: unknown): string {
  const value = String(token);
  return value.startsWith('Bearer ') ? value : `Bearer ${value}`;
}

export function buildSocketMiddlewareParams(socket: Socket): SocketMiddlewareParams {
  const headers = { ...socket.request.headers };
  const auth = socket.handshake.auth ?? {};

  const hasAuthorizationHeader =
    Boolean(headers.authorization) || Boolean(headers.Authorization);

  const rawToken = auth.token ?? auth.accessToken;
  if (rawToken && !hasAuthorizationHeader) {
    headers.authorization = formatBearerToken(rawToken);
  } else if (typeof auth.authorization === 'string' && !hasAuthorizationHeader) {
    headers.authorization = auth.authorization;
  }

  const request = socket.request as typeof socket.request & { conduit?: Indexable };

  return {
    headers,
    cookies: {},
    context: { ...request.conduit, ...socket.data },
  };
}
