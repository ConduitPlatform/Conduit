import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ObjectIndex } from '../models';

export const migrateObjectIndex = async (grpcSdk: ConduitGrpcSdk) => {
  const count = await ObjectIndex.getInstance().countDocuments({
    $or: [{ entityType: '' }, { entityId: '' }],
  });
  if (count === 0) {
    return;
  }
  let objectIndexes = await ObjectIndex.getInstance().findMany(
    {
      $or: [{ entityType: '' }, { entityId: '' }],
    },
    undefined,
    0,
    100,
  );
  let iterator = 0;
  while (objectIndexes.length > 0) {
    for (const objectIndex of objectIndexes) {
      await ObjectIndex.getInstance().findByIdAndUpdate(objectIndex._id, {
        subjectType: objectIndex.subject.split(':')[0],
        subjectId: objectIndex.subject.split(':')[1].split('#')[0],
        subjectPermission: objectIndex.subject.split('#')[1],
        entityType: objectIndex.entity.split(':')[0],
        entityId: objectIndex.entity.split(':')[1].split('#')[0],
        relation: objectIndex.subject.split('#')[1],
      });
    }
    objectIndexes = await ObjectIndex.getInstance().findMany(
      {
        $or: [{ entityType: '' }, { entityId: '' }],
      },
      undefined,
      ++iterator * 100,
      100,
    );
  }
};
