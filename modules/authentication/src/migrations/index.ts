import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { UserIdToUserTokenSchemaMigration } from './UserIdToUserTokenSchemaMigration';
import { UserIdToUserAccessTokenSchemaMigration } from './UserIdToUserAccessTokenSchemaMigration';
import { UserIdToUserRefreshTokenSchemaMigration } from './UserIdToUserRefreshTokenSchemaMigration';
import { UserIdToUserTwoFactorSchemaMigration } from './UserIdToUserTwoFactorSchemaMigration';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await UserIdToUserTokenSchemaMigration(grpcSdk);
  await UserIdToUserAccessTokenSchemaMigration(grpcSdk);
  await UserIdToUserRefreshTokenSchemaMigration(grpcSdk);
  await UserIdToUserTwoFactorSchemaMigration(grpcSdk);
}
