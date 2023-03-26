export interface FetchMembersParams {
  relations: FindRelationResponse;
  skip?: number;
  limit?: number;
  sort?: string;
  search?: string;
  populate?: string;
}

interface FindRelationResponse {
  relations: Relation[];
}

interface Relation {
  subject: string;
  relation: string;
  resource: string;
}
