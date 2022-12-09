import ConduitGrpcSdk from '../index';

type MigrationFunction = (grpcSdk: ConduitGrpcSdk) => Promise<void>;

export interface Migration {
  schemaName: string;
  from: string;
  to: string;
  up: MigrationFunction;
  down: MigrationFunction;
}
