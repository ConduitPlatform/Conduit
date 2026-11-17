import { SandboxedJob } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, ResourceDefinition } from '../models/index.js';
import { IndexController, QueueController } from '../controllers/index.js';
import {
  processPossibleConnections,
  ProcessPossibleConnectionsWorkerData,
} from './possibleConnections.js';

let grpcSdk: ConduitGrpcSdk | undefined = undefined;

export default async (job: SandboxedJob<ProcessPossibleConnectionsWorkerData>) => {
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
  await processPossibleConnections(job.data);
};
