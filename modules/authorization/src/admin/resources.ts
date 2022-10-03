import ConduitGrpcSdk, {
  ConduitRouteObject,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ResourceDefinition } from '../models';
import { isNil } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';

export class ResourceHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}
  //createResource
  //getResource(s)
  //deleteResource(s)
  //updateResource(s)

  getRoutes(): ConduitRouteObject[] {
    return [];
  }

  async getResources(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    //check how to search for group
    const { search, sort, group } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query = {};
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const nameSearch = escapeStringRegexp(search);
        query['name'] = { $regex: `.*${nameSearch}.*`, $options: 'i' };
      }
    }
    if (!isNil(group)) {
      query['group'] = group;
    }
    const resources = await ResourceDefinition.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count = ResourceDefinition.getInstance().countDocuments(query);
    return { resources, count };
  }
}
