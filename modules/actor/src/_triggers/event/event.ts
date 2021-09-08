import { Trigger } from '../../models/trigger.interface';
import { EventInterface } from './event.interface';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export class Event implements Trigger<EventInterface> {

  private static _instance: Event;
  private busInitialized: boolean = false;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.grpcSdk.initializeEventBus()
      .then(() => {
        console.log('Event bus initialized');
        this.busInitialized = true;
      })
      .catch(err => {
        console.error('Failed to initialize event trigger');
        console.error(err);
      });

  }

  public static getInstance(grpcSdk: ConduitGrpcSdk) {
    if (!Event._instance) {
      Event._instance = new Event(grpcSdk);
    }
    return Event._instance;
  }

  async setup(options: EventInterface): Promise<boolean> {
    if (this.busInitialized) {
      this.grpcSdk.bus!.subscribe(options.eventName, (data) => {
        let parsedData;
        try{
          parsedData = JSON.parse(data);
        }catch (e){
          parsedData = data;
        }
        options.queue.add({ eventName: options.eventName, data: parsedData });
      });
    } else {
      throw new Error('Event bus is not initialized');
    }
    return Promise.resolve(true);
  }


}
