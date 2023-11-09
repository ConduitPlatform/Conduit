import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Relationship } from '../models';

export const migrateRelationships = async (grpcSdk: ConduitGrpcSdk) => {
  const count = await Relationship.getInstance().countDocuments({
    $or: [{ resourceType: '' }, { resourceId: '' }],
  });
  if (count === 0) {
    return;
  }
  let relationships = await Relationship.getInstance().findMany(
    {
      $or: [{ resourceType: '' }, { resourceId: '' }],
    },
    undefined,
    0,
    100,
  );
  let iterator = 0;
  while (relationships.length > 0) {
    for (const objectIndex of relationships) {
      await Relationship.getInstance().findByIdAndUpdate(objectIndex._id, {
        subjectType: objectIndex.subject.split(':')[0],
        subjectId: objectIndex.subject.split(':')[1].split('#')[0],
        resourceType: objectIndex.resource.split(':')[0],
        resourceId: objectIndex.resource.split(':')[1].split('#')[0],
      });
    }
    relationships = await Relationship.getInstance().findMany(
      {
        $or: [{ resourceType: '' }, { resourceId: '' }],
      },
      undefined,
      ++iterator * 100,
      100,
    );
  }
};
