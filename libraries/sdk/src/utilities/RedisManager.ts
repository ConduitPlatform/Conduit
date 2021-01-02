import { ClientOpts, RedisClient } from "redis";

export class RedisManager{
    
    redisConnection: ClientOpts;

    constructor(redisIp: string, redisPort: any){
        this.redisConnection = {
            host: redisIp,
            port: redisPort
        }
    }

    getClient(connectionOps?: any): RedisClient{
        return new RedisClient({...this.redisConnection, ...connectionOps})
    }

}