import { EVENTS_NAMESPACE } from './constants.js';

export type EventRelayPusher = (
  event: string,
  data: unknown,
  rooms: string[],
) => Promise<void>;

export type SocketPushFn = (data: {
  event: string;
  data?: unknown;
  receivers: string[];
  rooms: string[];
  namespace: string;
  localOnly?: boolean;
}) => Promise<void>;

export function createEventRelayPusher(socketPush: SocketPushFn): EventRelayPusher {
  return (event, data, rooms) =>
    socketPush({
      event,
      data,
      receivers: [],
      rooms,
      namespace: EVENTS_NAMESPACE,
      localOnly: true,
    });
}
