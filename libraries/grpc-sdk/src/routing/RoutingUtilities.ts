import { RequestHandlers, wrapRouterGrpcFunction } from './wrapRouterFunctions';
import { ConduitModel, Indexable } from '../interfaces';
import { ConduitRouteOption, ConduitRouteOptions } from './interfaces';
import { FieldConstructor } from '../helpers';

export function wrapFunctionsAsync(
  functions: { [name: string]: RequestHandlers },
  routerType: 'admin' | 'client',
): {
  [name: string]: (call: Indexable, callback?: Indexable) => void;
} {
  const modifiedFunctions: {
    [name: string]: (call: Indexable, callback?: Indexable) => void;
  } = {};
  Object.keys(functions).forEach(key => {
    modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key], routerType);
  });
  return modifiedFunctions;
}

function constructParameters(paramArray: any) {
  for (const param in paramArray) {
    const field = paramArray[param];
    if (field instanceof FieldConstructor) {
      paramArray[param] = (field as FieldConstructor).construct();
    }
  }
  return paramArray;
}

export function buildParameters(input: ConduitRouteOptions) {
  if (input.queryParams) {
    input.queryParams = constructParameters(input.queryParams);
  }

  if (input.bodyParams) {
    input.bodyParams = constructParameters(input.bodyParams);
  }

  if (input.urlParams) {
    input.urlParams = constructParameters(input.urlParams);
  }

  return input;
}
