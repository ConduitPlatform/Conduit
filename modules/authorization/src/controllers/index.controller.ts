import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class IndexController {
  private static _instance: IndexController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (IndexController._instance) return IndexController._instance;
    if (grpcSdk) {
      return (IndexController._instance = new IndexController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  // todo
  async constructRelationIndex(subject: string, relation: string, object: string) {}
}
