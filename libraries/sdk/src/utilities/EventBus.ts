import { RedisClient } from "redis";
import { RedisManager } from "./RedisManager";

export class EventBus {
  private _clientSubscriber: RedisClient;
  private _clientPublisher: RedisClient;

  constructor(redisManager: RedisManager) {
    this._clientSubscriber = redisManager.getClient({prefix: "_bus",});
    this._clientPublisher = redisManager.getClient({prefix: "_bus",});
    this._clientSubscriber.on("ready", () => {
      console.log("The Bus is in the station...hehe");
    });
  }

  subscribe(channelName: string, callback: (message: string) => void): void {
    this._clientSubscriber.subscribe(channelName);
    this._clientSubscriber.on("message", (channel:string, message:string)=>{
      if(channel !== channelName) return;
      callback(message);
    });
  }

  publish(channelName: string, message: any) {
    this._clientPublisher.publish(channelName, message);
  }
}
