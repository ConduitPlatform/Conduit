import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateIsSuperAdminToAdmin } from './migrateIsSuperAdminToAdmin';
import { migrateAdminTwoFA } from './migrateAdminTwoFA';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await migrateIsSuperAdminToAdmin();
  await migrateAdminTwoFA();
}
