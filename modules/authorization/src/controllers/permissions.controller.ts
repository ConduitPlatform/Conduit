import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { checkRelation } from '../utils';

export class PermissionsController {
  private static _instance: PermissionsController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (PermissionsController._instance) return PermissionsController._instance;
    if (grpcSdk) {
      return (PermissionsController._instance = new PermissionsController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  async can(subject: string, action: string, object: string) {
    checkRelation(subject, action, object);
  }
}
