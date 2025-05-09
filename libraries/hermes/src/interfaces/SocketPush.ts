export interface SocketPush {
  event: string;
  data?: any;
  receivers: string[];
  rooms: string[];
  namespace: string;
}
