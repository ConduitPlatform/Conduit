export interface FetchMembersParams {
  relations: FindRelationResponse;
  skip?: any;
  limit?: number;
  sort?: string;
  search?: string;
}

interface FindRelationResponse {
  relations: Relation[];
}

interface Relation {
  subject: string;
  relation: string;
  resource: string;
}
