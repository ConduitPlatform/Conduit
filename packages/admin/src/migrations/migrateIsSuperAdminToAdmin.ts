import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Admin } from '../models';

export async function migrateIsSuperAdminToAdmin(grpcSdk: ConduitGrpcSdk) {
  const superAdmin: Admin = await grpcSdk.databaseProvider!.findOne('Admin', {
    username: 'admin',
  });
  superAdmin.isSuperAdmin = true;
  await grpcSdk.databaseProvider!.findByIdAndUpdate('Admin', superAdmin._id, superAdmin);
}
