import ConduitGrpcSdk from '../index';

type MigrationFunction = (grpcSdk: ConduitGrpcSdk) => Promise<void>;

export interface Migration {
  schemaName: string;
  v1: number;
  v2: number;
  up: MigrationFunction;
  down: MigrationFunction;
}
