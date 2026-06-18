import type { ConduitRouteParameters, Indexable } from '@conduitplatform/grpc-sdk';
import type { Socket } from 'socket.io';

export type SocketMiddlewareParams = ConduitRouteParameters & {
  headers: Indexable;
  context: Indexable;
  cookies: Indexable;
};

function formatBearerToken(token: unknown): string {
  const value = String(token);
  return value.startsWith('Bearer ') ? value : `Bearer ${value}`;
}

export function buildSocketMiddlewareParams(socket: Socket): SocketMiddlewareParams {
  const headers = { ...socket.request.headers };
  const auth = socket.handshake.auth ?? {};

  const hasAuthHeader =
    headers.authorization !== undefined || headers.Authorization !== undefined;

  if (!hasAuthHeader) {
    const rawToken = auth.token ?? auth.accessToken;
    if (rawToken) {
      headers.authorization = formatBearerToken(rawToken);
    } else if (typeof auth.authorization === 'string') {
      headers.authorization = auth.authorization;
    }
  }

  return {
    headers,
    cookies: {},
    context: {
      ...((socket.request as { conduit?: Record<string, unknown> }).conduit ?? {}),
      ...(socket.data ?? {}),
    },
  };
}
