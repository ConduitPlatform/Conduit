import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { UserIdToUserTokenSchemaMigration } from './UserIdToUserTokenSchemaMigration.js';
import { UserIdToUserAccessTokenSchemaMigration } from './UserIdToUserAccessTokenSchemaMigration.js';
import { UserIdToUserRefreshTokenSchemaMigration } from './UserIdToUserRefreshTokenSchemaMigration.js';
import { UserIdToUserTwoFactorSchemaMigration } from './UserIdToUserTwoFactorSchemaMigration.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await UserIdToUserTokenSchemaMigration(grpcSdk).catch(ignorePostgres);
  await UserIdToUserAccessTokenSchemaMigration(grpcSdk).catch(ignorePostgres);
  await UserIdToUserRefreshTokenSchemaMigration(grpcSdk).catch(ignorePostgres);
  await UserIdToUserTwoFactorSchemaMigration(grpcSdk).catch(ignorePostgres);
}

function ignorePostgres(error: { details: string }) {
  if (error.details.endsWith('.userId does not exist')) return;
  throw error;
}
