import { ParsedRouterRequest, UnparsedRouterResponse } from '../types';
import { wrapRouterGrpcFunction } from './wrapRouterFunctions';
import { SocketProtoDescription } from '../interfaces';


export function wrapFunctionsAsync(functions: {
  [name: string]:
    (call: ParsedRouterRequest) => Promise<UnparsedRouterResponse>
}): { [name: string]: (call: any, callback?: any) => void } {
  let modifiedFunctions: { [name: string]: (call: any, callback?: any) => void } = {};
  Object.keys(functions).forEach((key) => {
    modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key]);
  });
  return modifiedFunctions;
}

export function createProtoFunctions(paths: any[]) {
  let protoFunctions = '';

  paths.forEach((r) => {
    if (r.hasOwnProperty('events')) {
      protoFunctions += createProtoFunctionsForSocket(r, protoFunctions);
    } else {
      protoFunctions += createProtoFunctionForRoute(r, protoFunctions);
    }
  });

  return protoFunctions;
}

function createProtoFunctionsForSocket(
  path: SocketProtoDescription,
  protoFunctions: string
) {
  let newFunctions = '';
  const events = JSON.parse(path.events);
  Object.keys(events).forEach((event) => {
    const newFunction = createGrpcFunctionName(events[event].grpcFunction);

    if (protoFunctions.indexOf(newFunction) !== -1) {
      return;
    }

    newFunctions += `rpc ${newFunction}(SocketRequest) returns (SocketResponse);\n`;
  });

  return newFunctions;
}

function createProtoFunctionForRoute(path: any, protoFunctions: string) {
  const newFunction = createGrpcFunctionName(path.grpcFunction);

  if (protoFunctions.indexOf(newFunction) !== -1) {
    return '';
  }

  return `rpc ${newFunction}(RouterRequest) returns (RouterResponse);\n`;
}

function createGrpcFunctionName(grpcFunction: string) {
  return grpcFunction.charAt(0).toUpperCase() + grpcFunction.slice(1);
}
