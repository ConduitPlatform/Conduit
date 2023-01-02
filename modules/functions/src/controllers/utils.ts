import ConduitGrpcSdk, {
  ConduitRouteActions,
  GrpcError,
  RouteBuilder,
} from '@conduitplatform/grpc-sdk';
import { FunctionEndpoints } from '../models';
import { isNil } from 'lodash';
import { NodeVM } from 'vm2';
import { status } from '@grpc/grpc-js';

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

async function executeFunction(func: FunctionEndpoints, grpcSdk: ConduitGrpcSdk) {
  const vm = new NodeVM({
    console: 'inherit',
    sandbox: {},
    timeout: func.timeout,
  });
  try {
    const script = `module.exports = function(grpcSdk,req,res) { ${func.code} }`;
    const functionInSandbox = vm.run(script);
    const functionData = functionInSandbox(grpcSdk, func.inputs, func.returns);
    return { data: functionData };
  } catch (e) {
    throw new GrpcError(status.INTERNAL, 'Execution failed');
  }
}

export function createFunctionRoute(func: FunctionEndpoints, grpcSdk: ConduitGrpcSdk) {
  const route = new RouteBuilder()
    .path(`/${func.name}`)
    .method(getOperation(func.inputs?.method))
    .handler(() => executeFunction(func, grpcSdk));
  if (func.inputs?.auth) {
    route.middleware('authMiddleware');
  }
  const returns = !isNil(func.returns) ? func.returns : 'String';
  const inputsParams =
    func.inputs?.bodyParams || func.inputs?.queryParams || func.inputs?.urlParams;
  if (!isNil(inputsParams)) {
    if (!isNil(func.inputs?.bodyParams)) {
      route.bodyParams(func.inputs.bodyParams);
    }
    if (!isNil(func.inputs?.urlParams)) {
      route.urlParams(func.inputs.urlParams);
      let pathPostFix = '';
      Object.keys(func.inputs.urlParams).forEach(key => {
        pathPostFix += `/:${key}`;
      });
      route.path(`/${func.name}` + pathPostFix);
    }
    if (!isNil(func.inputs?.queryParams)) {
      route.queryParams(func.inputs.queryParams);
    }
  }
  route.return(getOperation(func.inputs?.method) + func.name, returns);
  return route.build();
}
