import { SandboxedJob } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, ResourceDefinition } from '../models/index.js';
import { IndexController, QueueController } from '../controllers/index.js';

let grpcSdk: ConduitGrpcSdk | undefined = undefined;

type ConstructRelationIndexWorkerData = {
  relation: { subject: string; relation: string; object: string };
};

export default async (job: SandboxedJob<ConstructRelationIndexWorkerData>) => {
  const { relation } = job.data;
  if (!grpcSdk) {
    if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
    grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authorization', false);
    await grpcSdk.initialize();
    await grpcSdk.initializeEventBus();
    await grpcSdk.waitForExistence('database');
    ObjectIndex.getInstance(grpcSdk.database!);
    ActorIndex.getInstance(grpcSdk.database!);
    ResourceDefinition.getInstance(grpcSdk.database!);
    IndexController.getInstance(grpcSdk);
    QueueController.getInstance(grpcSdk);
  }
  await IndexController.getInstance().constructRelationIndex(
    relation.subject,
    relation.relation,
    relation.object,
  );
};
