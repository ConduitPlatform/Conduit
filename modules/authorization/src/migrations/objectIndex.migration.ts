import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ObjectIndex } from '../models';

export const migrateObjectIndex = async (grpcSdk: ConduitGrpcSdk) => {
  const count = await ObjectIndex.getInstance().countDocuments({
    entityType: '',
  });
  if (count === 0) {
    return;
  }
  let objectIndexes = await ObjectIndex.getInstance().findMany(
    {
      entityType: '',
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
        subjectPermission: objectIndex.subject.split('#')[1],
        entityType: objectIndex.entity.split(':')[0],
        relation: objectIndex.subject.split('#')[1],
      });
    }
    objectIndexes = await ObjectIndex.getInstance().findMany(
      {
        entityType: '',
      },
      undefined,
      ++iterator * 100,
      100,
    );
  }
};
