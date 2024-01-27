import { RedisManager } from './RedisManager.js';
import { Cluster, Redis } from 'ioredis';
import crypto from 'crypto';
import ConduitGrpcSdk from '../index.js';

export class EventBus {
  private _clientSubscriber: Redis | Cluster;
  private _clientPublisher: Redis | Cluster;
  private _subscribedChannels: { [listener: string]: ((message: string) => void)[] };
  private _subscribers: { [listener: string]: [string, number] };
  private _signature: string;

  constructor(redisManager: RedisManager) {
    this._subscribedChannels = {};
    this._subscribers = {};
    this._clientSubscriber = redisManager.getClient({ keyPrefix: 'bus_' });
    this._clientPublisher = redisManager.getClient({ keyPrefix: 'bus_' });
    this._signature = crypto.randomBytes(20).toString('hex');
    this._clientSubscriber.on('ready', () => {
      ConduitGrpcSdk.Logger.log('The Bus is in the station...hehe');
    });
    process.on('exit', () => {
      this._clientSubscriber.quit();
      this._clientPublisher.quit();
    });
  }

  unsubscribe(subscriberId: string): void {
    if (this._subscribers[subscriberId]) {
      const [channelName, index] = this._subscribers[subscriberId];
      this._subscribedChannels[channelName].splice(index, 1);
      delete this._subscribers[subscriberId];
      if (this._subscribedChannels[channelName].length === 0) {
        delete this._subscribedChannels[channelName];
        this._clientSubscriber.unsubscribe(channelName, () => {});
      }
    }
  }

  subscribe(
    channelName: string,
    callback: (message: string) => void,
    subscriberId?: string,
  ): void {
    if (subscriberId) {
      // if subscriberId is provided, and it is already subscribed, unsubscribe it first
      this.unsubscribe(subscriberId);
    }
    if (this._subscribedChannels[channelName]) {
      this._subscribedChannels[channelName].push(callback);
      if (subscriberId) {
        this._subscribers[subscriberId] = [
          channelName,
          this._subscribedChannels[channelName].length - 1,
        ];
      }
      return;
    }
    this._subscribedChannels[channelName] = [callback];
    this._clientSubscriber.subscribe(channelName, () => {});
    const self = this;
    this._clientSubscriber.on('message', (channel: string, message: string) => {
      if (channel !== channelName) return;
      // if the message supports the signature
      if (message.indexOf('CND_Signature') !== -1) {
        // if the message does not contain this module's signature
        if (message.indexOf(self._signature) === -1) {
          self._subscribedChannels[channelName].forEach(fn => {
            fn(message.split('CND_Signature:')[0]);
          });
        }
      } else {
        self._subscribedChannels[channelName].forEach(fn => {
          fn(message);
        });
      }
    });
  }

  publish(channelName: string, message: string) {
    message = message + `CND_Signature:${this._signature}`;
    this._clientPublisher.publish(channelName, message);
  }
}
