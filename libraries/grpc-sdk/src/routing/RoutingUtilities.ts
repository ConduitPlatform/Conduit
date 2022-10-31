import { RequestHandlers, wrapRouterGrpcFunction } from './wrapRouterFunctions';
import { Indexable } from '../interfaces';

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
