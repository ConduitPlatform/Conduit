import { SandboxedJob } from 'bullmq';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, ResourceDefinition } from '../models';
import { IndexController } from '../controllers';

type ConstructRelationIndexWorkerData = {
  relation: { subject: string; relation: string; object: string };
};

module.exports = async (job: SandboxedJob<ConstructRelationIndexWorkerData>) => {
  const { relation } = job.data;
  if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
  const grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authorization', false);
  await grpcSdk.initialize();
  await grpcSdk.initializeEventBus();
  await grpcSdk.waitForExistence('database');
  ObjectIndex.getInstance(grpcSdk.database!);
  ActorIndex.getInstance(grpcSdk.database!);
  ResourceDefinition.getInstance(grpcSdk.database!);
  IndexController.getInstance(grpcSdk);
  await IndexController.getInstance().constructRelationIndex(
    relation.subject,
    relation.relation,
    relation.object,
  );
};
