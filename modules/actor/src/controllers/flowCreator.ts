import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import Queue from 'bull';
import { ActorFlowModel } from '../models';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { Cron } from '../_triggers/cron/cron';
import { Webhook } from '../_triggers/webhook/webhook';

const PROCESSOR_TEMPLATE = `
{{flow_requirements}}
module.exports = async function(job){
  let queueData = {
    data: job.data,
    previousNodes: [],
    followingNodes: []
  }
  
  {{flow_code}}
  return Promise.resolve(queueData);
}
`;

export class FlowCreator {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly server: GrpcServer
  ) {
    const self = this;
    grpcSdk
      .databaseProvider!.findMany('ActorFlows', { enabled: true })
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

  async constructFlow(flowData: ActorFlowModel) {
    let processorName = flowData.name + '__' + flowData._id;
    let processorCode = '' + PROCESSOR_TEMPLATE;
    let flowRequirements = '';
    let flowCode = '';
    flowData.actors.forEach((actor) => {
      if (flowRequirements.indexOf(actor.code) === -1) {
        flowRequirements += `const ${actor.code} = require(\'../_actors/${actor.code}/${actor.code}.actor.js\').default\n`;
      }

      flowCode += `
      let ${actor.code}Input = {
        actorOptions: ${JSON.stringify(actor.options)},
        context: {...queueData}
      }
      let ${actor.code}Return = await ${actor.code}(${actor.code}Input);
      console.log(${actor.code}Return)
      `;
    });

    processorCode = processorCode.replace('{{flow_requirements}}', flowRequirements);
    processorCode = processorCode.replace('{{flow_code}}', flowCode);
    mkdirSync(path.resolve(__dirname, `../processors`), { recursive: true });
    writeFileSync(
      path.resolve(__dirname, `../processors/${processorName}.js`),
      processorCode
    );

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
