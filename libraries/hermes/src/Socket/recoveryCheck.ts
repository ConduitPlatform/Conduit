import { ConduitError, ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import { HermesErrorCodes, toErrorResponse } from '../utils/errors.js';
import type { Socket } from 'socket.io';

export type SocketRecoveryCheck = (context: Indexable) => Promise<boolean>;

/**
 * Re-validates a recovered socket (Socket.IO skips middlewares on recovery).
 * Returns true when the recovered handler may run. Otherwise emits `conduit_error`,
 * disconnects the socket and returns false. With no check set, always returns true.
 */
export async function guardRecoveredSocket(
  socket: Pick<Socket, 'data' | 'emit' | 'disconnect'>,
  check?: SocketRecoveryCheck,
): Promise<boolean> {
  if (!check) return true;
  let allowed = false;
  try {
    allowed = (await check(socket.data)) === true;
  } catch (e) {
    ConduitGrpcSdk.Logger.error(e as Error);
  }
  if (!allowed) {
    ConduitGrpcSdk.Logger.warn(
      'Recovered socket failed re-authentication; disconnecting',
    );
    socket.emit(
      'conduit_error',
      toErrorResponse(
        new ConduitError(
          'UNAUTHENTICATED',
          401,
          'Unauthenticated',
          HermesErrorCodes.SOCKET_UNAUTHENTICATED,
        ),
      ),
    );
    socket.disconnect(true);
  }
  return allowed;
}

/**
 * One gate per socket. For recovered sockets it resolves after the re-authentication
 * check (never rejects; failures resolve false). Otherwise it resolves true immediately.
 */
export function createSocketGate(
  socket: Pick<Socket, 'data' | 'emit' | 'disconnect' | 'recovered'>,
  check?: SocketRecoveryCheck,
): Promise<boolean> {
  if (!socket.recovered) return Promise.resolve(true);
  return guardRecoveredSocket(socket, check).catch(e => {
    ConduitGrpcSdk.Logger.error(e as Error);
    return false;
  });
}

/**
 * Runs `fn` once the gate has resolved true and the socket is still connected.
 * Calls chained on the same gate run in registration order. Never rejects.
 */
export function runWhenAllowed(
  gate: Promise<boolean>,
  socket: Pick<Socket, 'connected'>,
  fn: () => unknown,
): Promise<void> {
  return gate
    .then(async ok => {
      if (!ok || !socket.connected) return;
      await fn();
    })
    .catch(e => {
      ConduitGrpcSdk.Logger.error(e as Error);
    });
}
