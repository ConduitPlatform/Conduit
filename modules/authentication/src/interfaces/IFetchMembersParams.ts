import { AuthorizationProtoUtils } from '@conduitplatform/grpc-sdk';

export interface FetchMembersParams {
  relations: AuthorizationProtoUtils.FindRelationResponse;
  skip?: number;
  limit?: number;
  sort?: string;
  search?: string;
  populate?: string;
}
