import {
  ConduitRouteActions,
  RequestHandlers,
  RouteBuilder,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ICustomEndpoint } from '../../interfaces';
import { isNil } from 'lodash';

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
  let resultingObject: any = {};
  inputs.forEach(
    (r: {
      name: string;
      type: string;
      location: number;
      optional?: boolean;
      array?: boolean;
    }) => {
      let placement = '';
      //body
      if (r.location === 0) {
        if (!resultingObject['bodyParams']) resultingObject['bodyParams'] = {};
        placement = 'bodyParams';
      }
      // query params
      else if (r.location === 1) {
        if (!resultingObject['queryParams']) resultingObject['queryParams'] = {};
        placement = 'queryParams';
      }
      // urlParams
      else {
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
  endpoint: ICustomEndpoint,
  handler: RequestHandlers,
) {
  let route = new RouteBuilder()
    .path(`/function/${endpoint.name}`)
    .method(getOperation(endpoint.operation))
    .handler(handler);
  if (endpoint.authentication) {
    route.middleware('authMiddleware');
  }
  let inputs = endpoint.inputs;
  let returns: any = { result: [endpoint.returns] };
  if (getOperation(endpoint.operation) === ConduitRouteActions.GET) {
    route.cacheControl(
      endpoint.authentication ? 'private, max-age=10' : 'public, max-age=10',
    );
  }
  if (endpoint.paginated) {
    inputs.push({
      name: 'skip',
      type: TYPE.Number,
      location: 1,
    });
    inputs.push({
      name: 'limit',
      type: TYPE.Number,
      location: 1,
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
      location: 1,
      optional: true,
      array: true,
    });
  }
  if (!isNil(endpoint.inputs) && endpoint.inputs.length > 0) {
    let params = extractParams(endpoint.inputs);
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
  return route.build();
}
