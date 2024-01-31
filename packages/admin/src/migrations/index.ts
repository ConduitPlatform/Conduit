import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateIsSuperAdminToAdmin } from './migrateIsSuperAdminToAdmin.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await migrateIsSuperAdminToAdmin();
}
