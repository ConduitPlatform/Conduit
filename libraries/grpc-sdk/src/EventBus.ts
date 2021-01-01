import { RedisClient } from "redis";

export class EventBus {
  private _clientSubscriber: RedisClient;
  private _clientPublisher: RedisClient;

  constructor(redisIp: string, redisPort: any) {
    this._clientSubscriber = new RedisClient({
      host: redisIp,
      port: parseInt(redisPort),
      prefix: "_bus",
    });
    this._clientPublisher = new RedisClient({
        host: redisIp,
        port: parseInt(redisPort),
        prefix: "_bus",
      });
    this._clientSubscriber.on("ready", () => {
      console.log("The Bus is in the station...hehe");
    });
  }

  subscribe(channelName: string, callback: (channel: string, message: string) => void): void {
    this._clientSubscriber.subscribe(channelName);
    this._clientSubscriber.on("message", callback);
  }

  publish(channelName: string, message: any) {
    this._clientPublisher.publish(channelName, message);
  }
}
