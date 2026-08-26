import { Job, Processor } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IndexController } from '../controllers/index.controller.js';
import { RuleCache } from '../controllers/cache.controller.js';

export type ConstructRelationIndexWorkerData = {
  relation: { subject: string; relation: string; object: string };
};

export function createConstructRelationIndexProcessor(
  grpcSdk: ConduitGrpcSdk,
): Processor<ConstructRelationIndexWorkerData> {
  return async (job: Job<ConstructRelationIndexWorkerData>) => {
    const { relation } = job.data;
    await IndexController.getInstance().constructRelationIndex(
      relation.subject,
      relation.relation,
      relation.object,
    );
    await RuleCache.invalidateSubject(grpcSdk, relation.subject);
  };
}
