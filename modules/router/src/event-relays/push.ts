import { EVENTS_NAMESPACE } from './constants.js';

export type EventRelayPusher = (
  event: string,
  data: unknown,
  rooms: string[],
  receivers?: string[],
) => Promise<boolean>;

export type SocketPushFn = (data: {
  event: string;
  data?: unknown;
  receivers: string[];
  rooms: string[];
  namespace: string;
  localOnly?: boolean;
  skipEmptyRooms?: boolean;
  boundedEmit?: boolean;
}) => Promise<boolean>;

export function createEventRelayPusher(socketPush: SocketPushFn): EventRelayPusher {
  return async (event, data, rooms, receivers = []) =>
    socketPush({
      event,
      data,
      receivers,
      rooms,
      namespace: EVENTS_NAMESPACE,
      localOnly: true,
      skipEmptyRooms: event !== 'leave-room',
      boundedEmit: event !== 'leave-room',
    });
}
