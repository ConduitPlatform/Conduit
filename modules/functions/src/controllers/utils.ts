import { ConduitRouteActions, GrpcError, RouteBuilder } from '@conduitplatform/grpc-sdk';
import { FunctionEndpoints } from '../models';
import { isNil } from 'lodash';
import { NodeVM } from 'vm2';
import { status } from '@grpc/grpc-js';

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

async function executeFunction(code: string, terminationTime: number) {
  const vm = new NodeVM({
    console: 'inherit',
    timeout: terminationTime,
  });
  try {
    const result = await vm.run(code);
    return { result };
  } catch (e) {
    throw new GrpcError(status.INTERNAL, 'Execution failed');
  }
}

export function createFunctionRoute(func: FunctionEndpoints) {
  const route = new RouteBuilder()
    .path(`/${func.name}`)
    .method(getOperation(func.method))
    .handler(() => executeFunction(func.code, func.timeout));
  if (func.authentication) {
    route.middleware('authMiddleware');
  }
  let returns: any = { result: [func.returns] };

  if (!isNil(func?.inputs) && func?.inputs.length > 0) {
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
      route.path(`/${func.name}` + pathPostFix);
    }
    if (params['queryParams']) {
      route.queryParams(params['queryParams']);
    }
  }
  route.return(getOperation(func.method) + func.name, returns);
  return route.build();
}
