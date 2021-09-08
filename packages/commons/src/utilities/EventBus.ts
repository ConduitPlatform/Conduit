import { RedisManager } from './RedisManager';
import { Redis } from 'ioredis';

export class EventBus {
  private _clientSubscriber: Redis;
  private _clientPublisher: Redis;
  private _subscribedChannels: { [listener: string]: ((message: string) => void)[] };

  constructor(redisManager: RedisManager) {
    this._subscribedChannels = {};
    this._clientSubscriber = redisManager.getClient({ keyPrefix: '_bus' });
    this._clientPublisher = redisManager.getClient({ keyPrefix: '_bus' });
    this._clientSubscriber.on('ready', () => {
      console.log('The Bus is in the station...hehe');
    });
  }

  subscribe(channelName: string, callback: (message: string) => void): void {
    if (this._subscribedChannels[channelName]) {
      this._subscribedChannels[channelName].push(callback);
      return;
    }
    this._subscribedChannels[channelName] = [callback];
    this._clientSubscriber.subscribe(channelName, () => {});
    const self = this;
    this._clientSubscriber.on('message', (channel: string, message: string) => {
      if (channel !== channelName) return;
      self._subscribedChannels[channelName].forEach((fn) => {
        fn(message);
      });
    });
  }

  publish(channelName: string, message: any) {
    this._clientPublisher.publish(channelName, message);
  }
}
