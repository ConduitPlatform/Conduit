import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { UserIdToUserTokenSchemaMigration } from './UserIdToUserTokenSchemaMigration';
import { UserIdToUserAccessTokenSchemaMigration } from './UserIdToUserAccessTokenSchemaMigration';
import { UserIdToUserRefreshTokenSchemaMigration } from './UserIdToUserRefreshTokenSchemaMigration';
import { UserIdToUserTwoFactorSchemaMigration } from './UserIdToUserTwoFactorSchemaMigration';

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
