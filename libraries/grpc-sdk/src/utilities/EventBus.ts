import { RedisManager } from './RedisManager';
import { Cluster, Redis } from 'ioredis';
import crypto from 'crypto';
import ConduitGrpcSdk from '../index';

export class EventBus {
  private _clientSubscriber: Redis | Cluster;
  private _clientPublisher: Redis | Cluster;
  private _subscribedChannels: { [listener: string]: ((message: string) => void)[] };
  private _signature: string;

  constructor(redisManager: RedisManager) {
    this._subscribedChannels = {};
    this._clientSubscriber = redisManager.getClient({ keyPrefix: 'bus_' });
    this._clientPublisher = redisManager.getClient({ keyPrefix: 'bus_' });
    this._signature = crypto.randomBytes(20).toString('hex');
    this._clientSubscriber.on('ready', () => {
      ConduitGrpcSdk.Logger.log('The Bus is in the station...hehe');
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
