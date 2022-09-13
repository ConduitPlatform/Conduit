import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export namespace RuleCache {
  function storeResolution(grpcSdk: ConduitGrpcSdk, rulePath: string, decision: any) {}

  function findResolution(grpcSdk: ConduitGrpcSdk, rulePath: string) {}
}
