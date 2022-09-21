import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Admin } from '../models';

export async function migrateIsSuperAdminToAdmin(grpcSdk: ConduitGrpcSdk) {
  const originalAdmin: Admin = await grpcSdk.databaseProvider!.findOne('Admin', {
    username: 'admin',
  });
  if (originalAdmin) {
    originalAdmin.isSuperAdmin = true;
    await grpcSdk.databaseProvider!.findByIdAndUpdate(
      'Admin',
      originalAdmin._id,
      originalAdmin,
    );
  }
}
