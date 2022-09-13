import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class RBAC {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  authorizeUser(user: string, resource: string, action: string) {}

  authorizeUserByPath(user: string, resourcePath: string, action: string) {}

  authorizeUserByPathAndMethod(
    user: string,
    resourcePath: string,
    action: string,
    method: string,
  ) {}

  constructAuthorizationQuery(user: string, resource: string, action: string) {}
}
