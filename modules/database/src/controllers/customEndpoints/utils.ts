import ConduitGrpcSdk, {
  ConduitRouteActions,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { RequestHandlers, RouteBuilder } from '@conduitplatform/module-tools';
import { PopulatedCustomEndpoint } from '../../interfaces/index.js';
import { isNil } from 'lodash-es';
import { LocationEnum } from '../../enums/index.js';

function getOperation(op: number) {
  switch (op) {
    case 0:
      return ConduitRouteActions.GET;
    case 1:
      return ConduitRouteActions.POST;
    case 2:
      return ConduitRouteActions.UPDATE;
    case 3:
      return ConduitRouteActions.DELETE;
    case 4:
      return ConduitRouteActions.PATCH;
    // won't ever be called by TS doesn't care about that
    default:
      return ConduitRouteActions.GET;
  }
}

function extractParams(
  inputs: {
    name: string;
    type: string;
    location: number;
    optional?: boolean;
    array?: boolean;
  }[],
) {
  const resultingObject: Indexable = {};
  inputs.forEach(
    (r: {
      name: string;
      type: string;
      location: number;
      optional?: boolean;
      array?: boolean;
    }) => {
      let placement = '';
      if (r.location === LocationEnum.BODY) {
        if (!resultingObject['bodyParams']) resultingObject['bodyParams'] = {};
        placement = 'bodyParams';
      } else if (r.location === LocationEnum.QUERY) {
        if (!resultingObject['queryParams']) resultingObject['queryParams'] = {};
        placement = 'queryParams';
      } else {
        if (!resultingObject['urlParams']) resultingObject['urlParams'] = {};
        placement = 'urlParams';
      }
      resultingObject[placement][r.name] = {
        type: r.array ? [r.type] : r.type,
        required: r.optional ? !r.optional : true,
      };
    },
  );
  return resultingObject;
}

export function createCustomEndpointRoute(
  endpoint: PopulatedCustomEndpoint,
  handler: RequestHandlers,
) {
  const authorizationEnabled =
    endpoint.selectedSchema.modelOptions.conduit!.authorization?.enabled || false;
  const route = new RouteBuilder()
    .path(`/function/${endpoint.name}`)
    .method(getOperation(endpoint.operation))
    .handler(handler);
  if (authorizationEnabled || endpoint.authentication) {
    route.middleware('authMiddleware');
  }
  const inputs = endpoint.inputs;
  let returns: any = { result: [endpoint.returns] };
  if (getOperation(endpoint.operation) === ConduitRouteActions.GET) {
    route.cacheControl(
      endpoint.authentication ? 'private, max-age=10' : 'public, max-age=10',
    );
  }
  if (authorizationEnabled) {
    inputs.push({
      name: 'scope',
      type: TYPE.String,
      optional: true,
      location: LocationEnum.QUERY,
    });
  }
  if (endpoint.paginated) {
    inputs.push({
      name: 'skip',
      type: TYPE.Number,
      location: LocationEnum.QUERY,
    });
    inputs.push({
      name: 'limit',
      type: TYPE.Number,
      location: LocationEnum.QUERY,
    });
    returns = {
      documents: [endpoint.returns],
      count: TYPE.Number,
    };
  }
  if (endpoint.sorted) {
    inputs.push({
      name: 'sort',
      type: TYPE.String,
      location: LocationEnum.QUERY,
      optional: true,
      array: true,
    });
  }
  if (!isNil(endpoint.inputs) && endpoint.inputs.length > 0) {
    const params = extractParams(endpoint.inputs);
    if (params['bodyParams']) {
      route.bodyParams(params['bodyParams']);
    }
    if (params['urlParams']) {
      route.urlParams(params['urlParams']);
      let pathPostFix = '';
      Object.keys(params.urlParams).forEach(key => {
        pathPostFix += `/:${key}`;
      });
      route.path(`/function/${endpoint.name}` + pathPostFix);
    }
    if (params['queryParams']) {
      route.queryParams(params['queryParams']);
    }
  }
  route.return(getOperation(endpoint.operation) + endpoint.name, returns);
  ConduitGrpcSdk.Metrics?.increment('custom_endpoints_total');
  return route.build();
}
