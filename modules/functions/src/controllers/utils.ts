import { ConduitRouteActions, RouteBuilder, TYPE } from '@conduitplatform/grpc-sdk';
import { FunctionEndpoints } from '../models';
import { isNil } from 'lodash';

export const LocationEnum = {
  BODY: 0,
  QUERY: 1,
  URL: 2,
};

function getOperation(op: string) {
  switch (op) {
    case 'GET':
      return ConduitRouteActions.GET;
    case 'POST':
      return ConduitRouteActions.POST;
    case 'UPDATE':
      return ConduitRouteActions.UPDATE;
    case 'DELETE':
      return ConduitRouteActions.DELETE;
    case 'PATCH':
      return ConduitRouteActions.PATCH;
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
  const resultingObject: any = {};
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

export function createFunctionRoute(func: FunctionEndpoints, handler: any) {
  const route = new RouteBuilder()
    .path(`/function/${func.name}`)
    .method(getOperation(func.method))
    .handler(handler);
  if (func.authentication) {
    route.middleware('authMiddleware');
  }
  const inputs = func.inputs;
  let returns: any = { result: [func.returns] };
  if (getOperation(func.method) === ConduitRouteActions.GET) {
    route.cacheControl(
      func.authentication ? 'private, max-age=10' : 'public, max-age=10',
    );
  }

  if (func.paginated) {
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
      documents: [func.returns],
      count: TYPE.Number,
    };
  }
  if (func.sorted) {
    inputs.push({
      name: 'sort',
      type: TYPE.String,
      location: LocationEnum.QUERY,
      optional: true,
      array: true,
    });
  }
  if (!isNil(func.inputs) && func.inputs.length > 0) {
    const params = extractParams(func.inputs);
    if (params['bodyParams']) {
      route.bodyParams(params['bodyParams']);
    }
    if (params['urlParams']) {
      route.urlParams(params['urlParams']);
      let pathPostFix = '';
      Object.keys(params.urlParams).forEach(key => {
        pathPostFix += `/:${key}`;
      });
      route.path(`/function/${func.name}` + pathPostFix);
    }
    if (params['queryParams']) {
      route.queryParams(params['queryParams']);
    }
  }
  route.return(getOperation(func.method) + func.name, returns);
  return route.build();
}
