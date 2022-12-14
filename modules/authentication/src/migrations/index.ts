import ConduitGrpcSdk, { Migration } from '@conduitplatform/grpc-sdk';
import { configMigration } from './configMigration';
import { UserIdToUserTokenSchemaMigration } from './UserIdToUserTokenSchemaMigration';
import { UserIdToUserAccessTokenSchemaMigration } from './UserIdToUserAccessTokenSchemaMigration';
import { UserIdToUserRefreshTokenSchemaMigration } from './UserIdToUserRefreshTokenSchemaMigration';
import { UserIdToUserTwoFactorSchemaMigration } from './UserIdToUserTwoFactorSchemaMigration';

const migrateConfig = {
  schemaName: 'Config',
  from: '0.14.0',
  to: '0.15.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    await configMigration(grpcSdk);
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

const migrateToken = {
  schemaName: 'Token',
  from: '0.14.0',
  to: '0.15.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    await UserIdToUserTokenSchemaMigration(grpcSdk);
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

const migrateAccessToken = {
  schemaName: 'AccessToken',
  from: '0.14.0',
  to: '0.15.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    await UserIdToUserAccessTokenSchemaMigration(grpcSdk);
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

const migrateRefreshToken = {
  schemaName: 'RefreshToken',
  from: '0.14.0',
  to: '0.15.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    await UserIdToUserRefreshTokenSchemaMigration(grpcSdk);
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

const migrateTwoFactorSecret = {
  schemaName: 'TwoFactorSecret',
  from: '0.14.0',
  to: '0.15.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    await UserIdToUserTwoFactorSchemaMigration(grpcSdk);
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

export const migrationFilesArray: Array<Migration> = [
  migrateConfig,
  migrateToken,
  migrateAccessToken,
  migrateRefreshToken,
  migrateTwoFactorSecret,
];
