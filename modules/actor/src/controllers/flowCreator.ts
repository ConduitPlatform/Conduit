import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import Queue from 'bull';
import { ActorFlow } from '../models';
import path from 'path';
import { Cron } from '../_triggers/cron/cron';
import { Webhook } from '../_triggers/webhook/webhook';
import flowConstructor from './flowConstructor';

export class FlowCreator {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly server: GrpcServer
  ) {
    const self = this;
    ActorFlow.getInstance()
      .findMany({ enabled: true })
      .then((r: any) => {
        if (!r || r.length == 0) return;
        return Promise.all(r.map((flow: any) => self.constructFlow(flow)));
      })
      .then(() => {
        console.log('Flows recovered and initialized');
      })
      .catch((err) => {
        console.log('Failed to recover flows');
        console.error(err);
      });
  }

  async constructFlow(flowData: ActorFlow) {
    let processorName = flowData.name + '__' + flowData._id;
    flowConstructor(processorName, flowData);
    let queue = new Queue(processorName);
    await this.setupTrigger(processorName, queue, flowData.trigger);
    queue.process(2, path.resolve(__dirname, `../processors/${processorName}.js`));
  }

  private async setupTrigger(
    processorName: string,
    queue: any,
    trigger: {
      code: string;
      name?: string;
      comments?: string;
      options: any;
    }
  ) {
    switch (trigger.code) {
      case 'cron':
        await Cron.getInstance().setup({
          jobName: processorName,
          queue,
          ...trigger.options,
        });
        break;
      case 'webhook':
        await Webhook.getInstance(this.grpcSdk, this.server).setup({
          jobName: processorName,
          queue,
          ...trigger.options,
        });
        break;
      default:
        throw new Error('No trigger matching');
    }
  }
}
