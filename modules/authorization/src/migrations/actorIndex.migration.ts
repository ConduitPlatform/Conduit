import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ActorIndex } from '../models';

export const migrateActorIndex = async (grpcSdk: ConduitGrpcSdk) => {
  const count = await ActorIndex.getInstance().countDocuments({
    entityType: '',
  });
  if (count === 0) {
    return;
  }
  let actorIndexes = await ActorIndex.getInstance().findMany(
    {
      entityType: '',
    },
    undefined,
    0,
    100,
  );
  let iterator = 0;
  while (actorIndexes.length > 0) {
    for (const actorIndex of actorIndexes) {
      await ActorIndex.getInstance().findByIdAndUpdate(actorIndex._id, {
        entityType: actorIndex.entity.split(':')[0],
        subjectType: actorIndex.subject.split(':')[0],
        relation: actorIndex.subject.split('#')[1],
      });
    }
    actorIndexes = await ActorIndex.getInstance().findMany(
      {
        entityType: '',
      },
      undefined,
      ++iterator * 100,
      100,
    );
  }
};