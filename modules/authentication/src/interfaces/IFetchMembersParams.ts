import { AuthorizationProto } from '@conduitplatform/grpc-sdk';

export interface FetchMembersParams {
  relations: AuthorizationProto.FindRelationResponse;
  skip?: number;
  limit?: number;
  sort?: string;
  search?: string;
  populate?: string;
}
