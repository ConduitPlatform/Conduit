import { Query } from '@conduitplatform/grpc-sdk';
import { Permission } from '../models/index.js';

export const migratePermission = async () => {
  const query: Query<Permission> = {
    $or: [
      { resourceType: '' },
      { resourceId: '' },
      { resourceType: { $exists: false } },
      { resourceId: { $exists: false } },
    ],
  };
  let permissions = await Permission.getInstance().findMany(query, undefined, 0, 100);

  while (permissions.length > 0) {
    for (const permission of permissions) {
      await Permission.getInstance().findByIdAndUpdate(permission._id, {
        subjectType: permission.subject.split(':')[0],
        subjectId: permission.subject.split(':')[1].split('#')[0],
        resourceType: permission.resource.split(':')[0],
        resourceId: permission.resource.split(':')[1].split('#')[0],
      });
    }
    permissions = await Permission.getInstance().findMany(query, undefined, 0, 100);
  }
};
