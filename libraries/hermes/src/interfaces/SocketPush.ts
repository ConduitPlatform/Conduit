export interface SocketPush {
  event: string;
  data?: any;
  receivers: string[];
  rooms: string[];
  namespace: string;
  localOnly?: boolean;
  /** Skip emit when the local room has no connected sockets. */
  skipEmptyRooms?: boolean;
  /** Drop or disconnect slow clients instead of blocking the caller. */
  boundedEmit?: boolean;
}
