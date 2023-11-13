import ConduitGrpcSdk, { Query } from '@conduitplatform/grpc-sdk';
import { Relationship } from '../models';

export const migrateRelationships = async (grpcSdk: ConduitGrpcSdk) => {
  const query: Query<any> = {
    $or: [
      { resourceType: '' },
      { resourceId: '' },
      { resourceType: { $exists: false } },
      { resourceId: { $exists: false } },
    ],
  };
  let relationships = await Relationship.getInstance().findMany(query, undefined, 0, 100);
  while (relationships.length > 0) {
    for (const objectIndex of relationships) {
      await Relationship.getInstance().findByIdAndUpdate(objectIndex._id, {
        subjectType: objectIndex.subject.split(':')[0],
        subjectId: objectIndex.subject.split(':')[1].split('#')[0],
        resourceType: objectIndex.resource.split(':')[0],
        resourceId: objectIndex.resource.split(':')[1].split('#')[0],
      });
    }
    relationships = await Relationship.getInstance().findMany(query, undefined, 0, 100);
  }
};
