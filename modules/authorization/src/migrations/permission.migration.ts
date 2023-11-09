import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Permission } from '../models';

export const migratePermission = async (grpcSdk: ConduitGrpcSdk) => {
  const count = await Permission.getInstance().countDocuments({
    $or: [{ resourceType: '' }, { resourceId: '' }],
  });
  if (count === 0) {
    return;
  }
  let permissions = await Permission.getInstance().findMany(
    {
      $or: [{ resourceType: '' }, { resourceId: '' }],
    },
    undefined,
    0,
    100,
  );
  let iterator = 0;
  while (permissions.length > 0) {
    for (const permission of permissions) {
      await Permission.getInstance().findByIdAndUpdate(permission._id, {
        subjectType: permission.subject.split(':')[0],
        subjectId: permission.subject.split(':')[1].split('#')[0],
        resourceType: permission.resource.split(':')[0],
        resourceId: permission.resource.split(':')[1].split('#')[0],
      });
    }
    permissions = await Permission.getInstance().findMany(
      {
        $or: [{ resourceType: '' }, { resourceId: '' }],
      },
      undefined,
      ++iterator * 100,
      100,
    );
  }
};
