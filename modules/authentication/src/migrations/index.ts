import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateLocalAuthConfig } from './localAuthConfig.migration'

export async function runMigrations(grpcSdk: ConduitGrpcSdk){
  await migrateLocalAuthConfig(grpcSdk);
}
