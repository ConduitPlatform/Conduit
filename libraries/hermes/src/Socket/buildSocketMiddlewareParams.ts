import type { Socket } from 'socket.io';

export function parseCookieHeader(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const segment of cookieHeader.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (name) {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function buildSocketMiddlewareParams(socket: Socket) {
  const headers = { ...socket.request.headers };
  const auth = socket.handshake.auth ?? {};

  const rawToken = auth.token ?? auth.accessToken ?? auth.access_token;
  if (rawToken && !headers.authorization && !headers.Authorization) {
    headers.authorization = `Bearer ${rawToken}`;
  }
  if (typeof auth.authorization === 'string') {
    headers.authorization = auth.authorization;
  }

  const cookies = parseCookieHeader(headers.cookie as string | undefined);

  return {
    headers,
    cookies,
    context: {
      ...((socket.request as { conduit?: Record<string, unknown> }).conduit ?? {}),
      ...(socket.data ?? {}),
    },
  };
}
