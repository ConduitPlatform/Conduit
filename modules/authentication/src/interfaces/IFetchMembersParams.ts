import { FindRelationResponse } from '@conduitplatform/grpc-sdk';

export interface FetchMembersParams {
  relations: FindRelationResponse;
  skip?: number;
  limit?: number;
  sort?: string;
  search?: string;
  populate?: string;
}
