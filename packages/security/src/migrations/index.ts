import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { secretMigrate } from './Secret.migrate';

export async function runMigrations(grpcSdk: ConduitGrpcSdk){
  await secretMigrate();
}
