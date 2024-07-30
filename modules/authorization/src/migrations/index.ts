import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { migrateObjectIndex } from './objectIndex.migration.js';
import { migrateActorIndex } from './actorIndex.migration.js';
import { migrateRelationships } from './relationship.migration.js';
import { migratePermission } from './permission.migration.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await Promise.all([
    migrateObjectIndex(),
    migrateActorIndex(),
    migrateRelationships(),
    migratePermission(),
  ]);
}
