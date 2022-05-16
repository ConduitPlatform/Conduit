import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateFoldersToContainers } from './container.migrations';

export async function runMigrations(grpcSdk: ConduitGrpcSdk){
  await migrateFoldersToContainers(grpcSdk);
}
