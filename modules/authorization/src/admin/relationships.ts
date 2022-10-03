import ConduitGrpcSdk, { ConduitRouteObject } from '@conduitplatform/grpc-sdk';

export class RelationshipHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}
  //createRelationship
  //getRelationship(s)
  //deleteRelationship(s) (many cases i think)
  //updateRelationship(s) ???

  getRoutes(): ConduitRouteObject[] {
    return [];
  }
}
