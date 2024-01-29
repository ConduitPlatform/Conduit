import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateConfig } from './migrateConfig.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await migrateConfig();
}
