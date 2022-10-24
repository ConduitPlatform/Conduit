import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateConfig } from './migrateConfig';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await migrateConfig();
}
