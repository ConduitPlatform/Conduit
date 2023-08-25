import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateObjectIndex } from './objectIndex.migration';
import { migrateActorIndex } from './actorIndex.migration';
import { migrateRelationships } from './relationship.migration';
import { migratePermission } from './permission.migration';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await Promise.all([
    migrateObjectIndex(grpcSdk),
    migrateActorIndex(grpcSdk),
    migrateRelationships(grpcSdk),
    migratePermission(grpcSdk),
  ]);
}
