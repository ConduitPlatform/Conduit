import ConduitGrpcSdk, {
  ConduitRouteActions,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { RouteBuilder } from '@conduitplatform/module-tools';
import { FunctionExecutions, Functions } from '../models';
import { isNil } from 'lodash';
import { NodeVM, VMScript } from 'vm2';
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

async function executeFunction(
  func: Functions,
  call: ParsedRouterRequest,
  functionCodeCompiled: VMScript,
  timeout: number,
  name: string,
  grpcSdk: ConduitGrpcSdk,
): Promise<UnparsedRouterResponse> {
  const logs: string[] | undefined = [];
  const vm = new NodeVM({
    console: 'redirect',
    sandbox: {},
    timeout: timeout,
    require: {
      external: true,
      import: ['lodash', 'axios'],
    },
  });
  vm.on('console.log', data => {
    logs?.push(data);
  });

  let duration;
  const start = process.hrtime();
  try {
    const functionInSandbox = vm.run(functionCodeCompiled);
    return new Promise((resolve, reject) => {
      functionInSandbox(grpcSdk, call.request, (data: any) => {
        const end = process.hrtime(start);
        duration = end[0] * 1e3 + end[1] / 1e6;
        addFunctionExecutions(name, duration, true, undefined, logs).then();
        ConduitGrpcSdk.Metrics?.increment('executed_functions_total');
        ConduitGrpcSdk.Metrics?.observe('function_execution_time', duration, {
          function_name: name,
        });
        if (func.returns === 'String') {
          resolve({ result: data });
        } else {
          // returns is a Proxy object, so we need to parse it to JSON
          // the values inside proxy are defined by the func.returns object
          const actualReturns: Indexable = {};
          for (const key in func.returns as Indexable) {
            actualReturns[key] = data[key];
          }
          resolve(actualReturns);
        }
      });
    });
  } catch (e) {
    const end = process.hrtime(start);
    duration = end[0] * 1e3 + end[1] / 1e6;
    await addFunctionExecutions(name, duration, false, e, logs);
    ConduitGrpcSdk.Metrics?.increment('failed_functions_total');
    ConduitGrpcSdk.Metrics?.observe('function_execution_time', duration, {
      function_name: name,
    });
    throw new GrpcError(status.INTERNAL, 'Execution failed');
  }
}

export function createRequestOrWebhookFunction(func: Functions, grpcSdk: ConduitGrpcSdk) {
  const compiledFunctionCode = compileFunctionCode(func.functionCode);
  const route = new RouteBuilder()
    .path(`${func.functionType !== 'request' ? '/hook' : ''}/${func.name}`)
    .method(getOperation(func.inputs?.method))
    .handler((call: ParsedRouterRequest) => {
      return executeFunction(
        func,
        call,
        compiledFunctionCode,
        func.timeout,
        func.name,
        grpcSdk,
      );
    });
  if (func.inputs?.auth && func.functionType === 'request') {
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

export function createMiddlewareFunction(func: Functions, grpcSdk: ConduitGrpcSdk) {
  const compiledFunctionCode = compileFunctionCode(func.functionCode);
  return {
    input: { path: '/', name: func.name },
    handler: (call: ParsedRouterRequest) => {
      return executeFunction(
        func,
        call,
        compiledFunctionCode,
        func.timeout,
        func.name,
        grpcSdk,
      );
    },
  };
}

export function createFunctionRoute(func: Functions, grpcSdk: ConduitGrpcSdk) {
  switch (func.functionType) {
    case 'request':
      return createRequestOrWebhookFunction(func, grpcSdk);
    case 'webhook':
      return createRequestOrWebhookFunction(func, grpcSdk);
    case 'cron':
    //todo
    case 'event':
    //todo
    case 'socket':
    //todo
    case 'middleware':
      return createMiddlewareFunction(func, grpcSdk);
  }
}

async function addFunctionExecutions(
  functionName: string,
  duration: number,
  success: boolean,
  error?: any,
  logs?: string[],
) {
  const query = {
    functionName,
    duration,
    success,
    error,
    logs,
  };
  await FunctionExecutions.getInstance().create(query);
}

export function compileFunctionCode(functionCode: string) {
  const script = `module.exports = function(grpcSdk,req,res) { ${functionCode} }`;
  let functionScriptCompiled;
  try {
    functionScriptCompiled = new VMScript(script).compile();
  } catch (e) {
    throw new GrpcError(status.INTERNAL, 'Compilation failed');
  }
  return functionScriptCompiled;
}
