import { RedisManager } from './RedisManager.js';
import { Cluster, Redis } from 'ioredis';
import crypto from 'crypto';
import { getLogger } from './GrpcSdkContext.js';

type ChannelCallbacks = Map<string, (message: string) => void>;

export class EventBus {
  private _clientSubscriber: Redis | Cluster;
  private _clientPublisher: Redis | Cluster;
  /** channelName -> subscriberId -> callback */
  private _channelCallbacks: Map<string, ChannelCallbacks>;
  /** subscriberId -> channelName */
  private _subscriberChannels: Map<string, string>;
  /** channels with a successful Redis SUBSCRIBE */
  private _redisSubscribedChannels: Set<string>;
  private _signature: string;
  private _anonymousSubscriberSeq = 0;
  private _shuttingDown = false;

  constructor(redisManager: RedisManager) {
    this._channelCallbacks = new Map();
    this._subscriberChannels = new Map();
    this._redisSubscribedChannels = new Set();
    this._clientSubscriber = redisManager.getClient({ keyPrefix: 'bus_' });
    this._clientPublisher = redisManager.getClient({ keyPrefix: 'bus_' });
    this._signature = crypto.randomBytes(20).toString('hex');
    this._clientSubscriber.on('ready', () => {
      getLogger().log('The Bus is in the station...hehe');
    });
    this._clientSubscriber.on('message', (channel: string, message: string) => {
      this.dispatch(channel, message);
    });
    const shutdown = () => {
      this.quit();
    };
    process.on('exit', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  quit(): void {
    if (this._shuttingDown) return;
    this._shuttingDown = true;
    void this._clientSubscriber.quit();
    void this._clientPublisher.quit();
  }

  unsubscribe(subscriberId: string): void {
    const channelName = this._subscriberChannels.get(subscriberId);
    if (!channelName) {
      return;
    }
    const callbacks = this._channelCallbacks.get(channelName);
    callbacks?.delete(subscriberId);
    this._subscriberChannels.delete(subscriberId);
    if (callbacks && callbacks.size === 0) {
      this._channelCallbacks.delete(channelName);
      if (this._redisSubscribedChannels.delete(channelName)) {
        this._clientSubscriber.unsubscribe(channelName, () => {});
      }
    }
  }

  subscribe(
    channelName: string,
    callback: (message: string) => void,
    subscriberId?: string,
  ): void {
    if (this._shuttingDown) {
      return;
    }
    const id =
      subscriberId ??
      `anon:${channelName}:${++this._anonymousSubscriberSeq}:${crypto.randomBytes(4).toString('hex')}`;
    if (subscriberId) {
      this.unsubscribe(subscriberId);
    }

    let callbacks = this._channelCallbacks.get(channelName);
    if (!callbacks) {
      callbacks = new Map();
      this._channelCallbacks.set(channelName, callbacks);
    }
    callbacks.set(id, callback);
    this._subscriberChannels.set(id, channelName);

    if (this._redisSubscribedChannels.has(channelName)) {
      return;
    }

    this._clientSubscriber.subscribe(channelName, err => {
      if (err) {
        getLogger().error(
          `EventBus failed to subscribe to ${channelName}: ${err.message}`,
        );
        const pending = this._channelCallbacks.get(channelName);
        if (pending) {
          for (const subId of pending.keys()) {
            this._subscriberChannels.delete(subId);
          }
          this._channelCallbacks.delete(channelName);
        }
        return;
      }
      this._redisSubscribedChannels.add(channelName);
    });
  }

  publish(channelName: string, message: string) {
    message = message + `CND_Signature:${this._signature}`;
    this._clientPublisher.publish(channelName, message);
  }

  private dispatch(channel: string, message: string): void {
    const callbacks = this._channelCallbacks.get(channel);
    if (!callbacks || callbacks.size === 0) {
      return;
    }
    let payload = message;
    if (message.indexOf('CND_Signature') !== -1) {
      if (message.indexOf(this._signature) !== -1) {
        return;
      }
      payload = message.split('CND_Signature:')[0];
    }
    for (const fn of callbacks.values()) {
      fn(payload);
    }
  }
}
